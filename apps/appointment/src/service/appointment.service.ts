import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as admin from 'firebase-admin';
import { CacheService } from 'libs/cache.service';
import { Appointment, AppointmentStatus, ExaminationMethod } from '../core/schema/Appointment.schema';
import { BookAppointmentDto } from '../core/dto/appointment.dto';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';

@Injectable()
export class AppointmentService {
  constructor(
    @InjectModel(Appointment.name, 'appointmentConnection') private appointmentModel: Model<Appointment>,
    @Inject('DOCTOR_CLIENT') private doctorClient: ClientProxy,
    @Inject('USERS_CLIENT') private usersClient: ClientProxy,
    private cacheService: CacheService,
  ) { }
  async getDoctorStats(doctorID: string) {
    const patientsCount = await this.appointmentModel.countDocuments({
      doctor: doctorID,
      status: 'done',
    });

    // const ratingsCount = await this.reviewModel.countDocuments({
    //     doctor: doctorID,
    // });

    return { patientsCount };
  }

  // 📌 Đặt lịch hẹn
  async bookAppointment(bookData: BookAppointmentDto) {
    const { doctorID, patientID, patientModel, date, time, status, examinationMethod, reason, notes, totalCost, location } = bookData;

    const doctor = await this.doctorClient.send('doctor.get-by-id', doctorID);
    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }
    if (doctorID === patientID) {
      throw new BadRequestException('You cannot book an appointment for yourself')
    }

    //bác sĩ không được đặt lịch hẹn cho chính mình
    if (doctorID === patientID) {
      throw new BadRequestException('You cannot book an appointment for yourself');
    }

    // Chặn nếu đã có lịch PENDING
    const pendingAppointment = await this.appointmentModel.findOne({
      doctor: doctorID,
      date,
      time,
      status: AppointmentStatus.PENDING,
    });

    if (pendingAppointment) {
      throw new BadRequestException('This time slot is already booked');
    }

    // Xóa cache lịch hẹn bệnh nhân
    this.clearPatientAppointmentCache(patientID);

    // Tìm lịch đã hủy để tái sử dụng
    const cancelledAppointment = await this.appointmentModel.findOne({
      doctor: doctorID,
      patient: patientID,
      date,
      time,
      status: AppointmentStatus.CANCELLED,
    });

    let appointment;

    if (cancelledAppointment) {
      // Cập nhật lại lịch đã huỷ
      cancelledAppointment.status = AppointmentStatus.PENDING;
      cancelledAppointment.examinationMethod = examinationMethod as ExaminationMethod || ExaminationMethod.AT_CLINIC;
      cancelledAppointment.reason = reason;
      cancelledAppointment.notes = notes;
      cancelledAppointment.totalCost = totalCost;
      cancelledAppointment.location = location;

      await cancelledAppointment.save();
      appointment = cancelledAppointment;
    } else {
      // Tạo cuộc hẹn mới
      const newAppointment = new this.appointmentModel({
        doctor: doctorID,
        patientModel,
        patient: patientID,
        date,
        time,
        status: status || AppointmentStatus.PENDING,
        examinationMethod: examinationMethod || 'at_clinic',
        reason,
        notes,
        totalCost,
        location,
      });

      await newAppointment.save();
      appointment = newAppointment;
    }

    // Thông báo và xóa cache

    try {
      // Gửi thông báo đến bác sĩ - QUAN TRỌNG: thêm .toPromise()
      await this.doctorClient.send('doctor.notify', {
        doctorID: doctorID,
        message: "Bạn có lịch hẹn mới!"
      }).toPromise();

      // Gửi thông báo đến bệnh nhân
      await this.usersClient.send('user.notify', {
        userID: patientID,
        message: "Bạn đã đặt lịch hẹn thành công!"
      }).toPromise();

      console.log('✅ Đã gửi thông báo thành công');
    } catch (error) {
      console.error('❌ Lỗi khi gửi thông báo:', error);
      // Không throw error để appointment vẫn được lưu
    }
    this.clearDoctorAppointmentCache(doctorID);

    return {
      message: 'Appointment booked successfully',
      appointment,
    };
  }

  // hàm hủy cache bác sĩ
  async clearDoctorAppointmentCache(doctorID: string) {
    const doctorCacheKey = 'all_doctor_appointments_' + doctorID;
    await this.cacheService.deleteCache(doctorCacheKey);
  }

  // hàm hủy cache bệnh nhân
  async clearPatientAppointmentCache(patientID: string) {
    const patientCacheKey = 'all_patient_appointments_' + patientID;
    await this.cacheService.deleteCache(patientCacheKey);
  }

  // 📌 Hủy lịch hẹn
  async cancelAppointment(id: string) {
    const appointment = await this.appointmentModel.findById(id);
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    const patientID = appointment.patient.toString();
    const doctorID = appointment.doctor.toString();

    appointment.status = AppointmentStatus.CANCELLED;

    // Xóa cache bệnh nhân & bác sĩ
    //await this.clearPatientAppointmentCache(patientID);
    //await this.clearDoctorAppointmentCache(doctorID);


    try {
      // Gửi thông báo đến bác sĩ - QUAN TRỌNG: thêm .toPromise()
      await this.doctorClient.send('doctor.notify', {
        doctorID: doctorID,
        message: "Bệnh nhân đã hủy lịch hẹn!"
      }).toPromise();

      // Gửi thông báo đến bệnh nhân
      await this.usersClient.send('user.notify', {
        userID: patientID,
        message: "Bạn đã hủy lịch hẹn thành công!"
      }).toPromise();

      console.log('✅ Đã gửi thông báo thành công');
    } catch (error) {
      console.error('❌ Lỗi khi gửi thông báo:', error);
      // Không throw error để appointment vẫn được lưu
    }
    await appointment.save();

    return { message: 'Appointment cancelled successfully' };
  }

  // Xác nhận lịch hẹn
  async confirmAppointmentDone(id: string) {
    const objectId = new Types.ObjectId(id);
    const appointment = await this.appointmentModel.findById(objectId);
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    const patientID = appointment.patient.toString();
    const doctorID = appointment.doctor.toString();

    // Xóa cache bệnh nhân & bác sĩ
    await this.clearPatientAppointmentCache(patientID);
    await this.clearDoctorAppointmentCache(doctorID);

    appointment.status = AppointmentStatus.DONE;

    await this.doctorClient.send('doctor.notify', { doctorID, message: "Lịch hẹn của bệnh nhân đã hoàn thành!" });
    await this.usersClient.send('user.notify', { userID: patientID, message: "Lịch hẹn của bệnh nhân đã hoàn thành!" });
    await appointment.save();

    return { message: 'Appointment confirmed done successfully', appointment };
  }

  // Lấy danh sách tất cả lịch hẹn
  async getAllAppointments() {
    //const cacheKey = 'appointments_cache';
    //console.log('Trying to get all appointments from cache...');

    // const cached = await this.cacheService.getCache(cacheKey);
    // if (cached) {
    //   //console.log('Cache HIT');
    //   return cached;
    // }

    //console.log('Cache MISS - querying DB');

    const appointmentsRaw = await this.appointmentModel.find()
      .populate({
        path: 'doctor',
        match: { isDeleted: false },
        select: 'name specialty hospital address',
        populate: {
          path: 'specialty',
          select: 'name avatarURL',
        },
      })
      .populate({
        path: 'patient',
        match: { isDeleted: false },
        select: '_id name',
      });

    const appointments = appointmentsRaw.filter(appt => appt.doctor && appt.patient);
    //await this.cacheService.setCache(cacheKey, appointments, 10000); //cache for 30 seconds

    return appointments;
  }

  // Lấy danh sách lịch hẹn của bác sĩ
  async getDoctorAppointments(doctorID: string) {
    const doctor = await this.doctorClient.send('doctor.get-by-id', { id: doctorID });
    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    // Lấy raw appointments từ database
    const appointmentsRaw = await this.appointmentModel.find({ doctor: doctorID });

    // Populate thủ công
    const appointments = [];

    for (const appt of appointmentsRaw) {
      try {
        // Gọi microservice để lấy thông tin doctor
        const doctorInfo = await firstValueFrom(
          this.doctorClient
            .send('doctor.get-by-id', appt.doctor.toString())
            .pipe(timeout(10000))
        );

        // Gọi microservice để lấy thông tin patient
        const patientInfo = await firstValueFrom(
          this.usersClient
            .send('user.getuserbyid', appt.patient.toString())
            .pipe(timeout(10000))
        );

        appointments.push({
          ...appt.toObject(),
          doctor: doctorInfo
            ? {
              _id: doctorInfo._id,
              name: doctorInfo.name,
              avatarURL: doctorInfo.avatarURL,
            }
            : null,
          patient: patientInfo
            ? {
              _id: patientInfo._id,
              name: patientInfo.name,
            }
            : null,
        });
      } catch (err) {
        console.error('Populate error for appointment:', appt._id, err);
        // Nếu lỗi, vẫn thêm appointment nhưng không có thông tin populate
        appointments.push(appt.toObject());
      }
    }

    // Filter và sort appointments
    const filteredAppointments = appointments
      .filter((appt) => appt.doctor !== null && appt.patient !== null)
      .sort((a, b) => {
        const dateA = new Date(`${a.date.toISOString().split('T')[0]}T${a.time}`);
        const dateB = new Date(`${b.date.toISOString().split('T')[0]}T${b.time}`);
        return dateB.getTime() - dateA.getTime(); // Mới nhất trước
      });

    if (filteredAppointments.length === 0) {
      throw new NotFoundException('No appointments found for this doctor');
    }

    return filteredAppointments;
  }

  // Lấy danh sách lịch hẹn của bệnh nhân
  async getPatientAppointments(patientID: string) {
    // --- tìm user ---
    var patient = await this.usersClient.send('user.getuserbyid', new Types.ObjectId(patientID));
    if (!patient) {
      patient = await this.doctorClient.send('doctor.get-by-id', new Types.ObjectId(patientID));
    }

    // --- cache ---
    // const cacheKey = 'all_patient_appointments_' + patientID;
    // const cached = await this.cacheService.getCache(cacheKey);
    // if (cached) return cached;

    const appointmentsRaw = await this.appointmentModel.find({
      patient: new Types.ObjectId(patientID),
    });

    //console.log("RAW APPOINTMENTS:", appointmentsRaw);

    // --- populate thủ công ---
    const appointments = [];

    for (const appt of appointmentsRaw) {
      try {

        // console.log("DOCTOR ID:", appt.doctor.toString());
        // console.log("PATIENT ID:", appt.patient.toString());
        const doctor = await firstValueFrom(
          this.doctorClient
            .send('doctor.get-by-id', appt.doctor.toString())
            .pipe(timeout(10000))
        );

        const patient = await firstValueFrom(
          this.usersClient
            .send('user.getuserbyid', appt.patient.toString())
            .pipe(timeout(10000))
        );

        appointments.push({
          ...appt.toObject(),
          doctor: doctor
            ? {
              _id: doctor._id,
              name: doctor.name,
              avatarURL: doctor.avatarURL,
            }
            : null,
          patient: patient
            ? {
              _id: patient._id,
              name: patient.name,
            }
            : null,
        });

        //console.log("APPOINTMENT:", appointments[appointments.length - 1]);
      } catch (err) {
        console.error('Populate error:', err);
        appointments.push(appt.toObject());
      }
    }

    const filterAppointments = appointments
      .filter((appt) => appt.doctor !== null)
      .sort((a, b) => {
        const dateA = new Date(`${a.date.toISOString().split('T')[0]}T${a.time}`);
        const dateB = new Date(`${b.date.toISOString().split('T')[0]}T${b.time}`);
        return dateB.getTime() - dateA.getTime(); // Mới nhất trước
      });

    if (!appointments) {
      throw new NotFoundException('No appointments found for this patient');
    }
    // cache 30s
    //await this.cacheService.setCache(cacheKey, filterAppointments, 30 * 1000);

    return filterAppointments;
  }


  // Lấy danh sách lịch hẹn theo status
  async getAppointmentsByStatus(patientID: string, status: string): Promise<Appointment[]> {
    const rawAppointments = await this.appointmentModel.find({
      patient: patientID,
      status: status,
    }).populate({
      path: 'doctor',
      match: { isDeleted: false },
      select: 'name',
    });

    const appointments = rawAppointments.filter(appt => appt.doctor !== null);
    return appointments;
  }


  async getAppointmentsbyitsID(id: string) {
    const appointment = await this.appointmentModel.findById(id);
    return appointment;
  }

  async updateAppointment(id: string, updateData: Partial<BookAppointmentDto>) {
    console.log('=== UPDATE DEBUG ===');
    console.log('ID:', id);
    console.log('Update Data:', JSON.stringify(updateData, null, 2));

    const objectId = new Types.ObjectId(id);

    // Kiểm tra document hiện tại
    const currentDoc = await this.appointmentModel.findById(objectId);
    console.log('Current time BEFORE update:', currentDoc?.time);

    // Thử update trực tiếp bằng updateOne
    const updateResult = await this.appointmentModel.updateOne(
      { _id: objectId },
      { $set: updateData }
    );

    console.log('Update result:', updateResult);

    // Fetch lại document sau khi update
    const appointment = await this.appointmentModel.findById(objectId);
    console.log('Current time AFTER update:', appointment?.time);

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    const patientID = appointment.patient.toString();
    const doctorID = appointment.doctor.toString();
    const patientCacheKey = 'all_patient_appointments_' + patientID;
    const doctorCacheKey = 'all_doctor_appointments_' + doctorID;

    await this.cacheService.deleteCache(patientCacheKey);
    await this.cacheService.deleteCache(doctorCacheKey);

    return { message: 'Appointment updated successfully', appointment };
  }

  async deleteAppointment(id: string) {
    const appointment = await this.appointmentModel.findById(id);
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    const patientID = appointment.patient.toString();
    const doctorID = appointment.doctor.toString();

    // Xóa lịch hẹn
    await this.appointmentModel.findByIdAndDelete(id);

    // Xóa cache bệnh nhân & bác sĩ
    const patientCacheKey = 'all_patient_appointments_' + patientID;
    const doctorCacheKey = 'all_doctor_appointments_' + doctorID;
    await this.cacheService.deleteCache(patientCacheKey);
    await this.cacheService.deleteCache(doctorCacheKey);

    return { message: 'Appointment deleted successfully' };
  }

  async getDoctorBookAppointment(data: { doctorID: string; startDate: string; endDate: string }) {
    console.log('Received data:', data);

    // Validate parameters
    if (!data || !data.startDate || !data.endDate) {
      throw new Error('startDate and endDate are required');
    }

    const { doctorID, startDate, endDate } = data;

    // Convert string dates to Date objects
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);

    // Validate the dates
    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      throw new Error('Invalid date format');
    }

    console.log('Querying appointments for:', {
      doctorID,
      startDate: startDateObj,
      endDate: endDateObj,
      dateRange: {
        gte: startDateObj.toISOString().split('T')[0],
        lt: endDateObj.toISOString().split('T')[0]
      }
    });

    const appointments = await this.appointmentModel
      .find({
        doctor: doctorID,
        date: {
          $gte: startDateObj,
          $lt: endDateObj,
        },

        status: { $in: ['pending', 'confirmed', 'done'] },
      })
      .select('date time')
      .lean();

    console.log('Found appointments:', appointments);
    return appointments.map(a => ({
      date: new Date(a.date).toISOString().split('T')[0],
      time: a.time,
    }));

  }
}
