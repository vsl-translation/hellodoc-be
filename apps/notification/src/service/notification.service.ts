import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Notification } from '../core/schema/notification.schema';
import { CreateNotificationDto } from '../core/dto/create-notification.dto';
import { UpdateNotificationDto } from '../core/dto/update-notification.dto';
import { SendBulkNotificationDto } from '../core/dto/send-bulk-notification.dto';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class NotificationService {
  constructor(
    @InjectModel(Notification.name, 'notificationConnection')
    private notificationModel: Model<Notification>,
    @Inject('USERS_CLIENT') private usersClient: ClientProxy,
    @Inject('DOCTOR_CLIENT') private doctorClient: ClientProxy,
  ) {}

  // Tạo thông báo mới
  async createNotification(createNotificationDto: CreateNotificationDto) {
    const notification = new this.notificationModel(createNotificationDto);
    await notification.save();

    return notification;
  }

  // Lấy tất cả thông báo của user
  async getNotificationsByUser(userId: string) {
    const notifications = await this.notificationModel
      .find({
        userId,
        isDeleted: false,
      })
      .sort({ createdAt: -1 })
      .limit(50);

    return notifications;
  }

  // Lấy thông báo chưa đọc của user
  async getUnreadNotifications(userId: string) {
    const notifications = await this.notificationModel
      .find({
        userId,
        isRead: false,
        isDeleted: false,
      })
      .sort({ createdAt: -1 });

    return notifications;
  }

  // Đếm số thông báo chưa đọc
  async getUnreadCount(userId: string) {
    const count = await this.notificationModel.countDocuments({
      userId,
      isRead: false,
      isDeleted: false,
    });

    return { count };
  }

  // Đánh dấu thông báo là đã đọc
  async markAsRead(id: string) {
    const notification = await this.notificationModel.findByIdAndUpdate(
      id,
      {
        isRead: true,
        readAt: new Date(),
      },
      { new: true },
    );

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return notification;
  }

  // Đánh dấu tất cả thông báo của user là đã đọc
  async markAllAsRead(userId: string) {
    const result = await this.notificationModel.updateMany(
      {
        userId,
        isRead: false,
        isDeleted: false,
      },
      {
        isRead: true,
        readAt: new Date(),
      },
    );

    return {
      message: 'All notifications marked as read',
      modifiedCount: result.modifiedCount,
    };
  }

  // Xóa thông báo (soft delete)
  async deleteNotification(id: string) {
    const notification = await this.notificationModel.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true },
    );

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return { message: 'Notification deleted successfully' };
  }

  // Lấy thông báo theo ID
  async getNotificationById(id: string) {
    const notification = await this.notificationModel.findById(id);

    if (!notification || notification.isDeleted) {
      throw new NotFoundException('Notification not found');
    }

    return notification;
  }

  // Cập nhật thông báo
  async updateNotification(id: string, updateDto: UpdateNotificationDto) {
    const notification = await this.notificationModel.findByIdAndUpdate(
      id,
      updateDto,
      { new: true },
    );

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return notification;
  }

  // Gửi thông báo cho nhiều user
  async sendBulkNotifications(
    sendBulkNotificationDto: SendBulkNotificationDto,
  ) {
    const { userIds, userModel, type, content, navigatePath } =
      sendBulkNotificationDto;

    const notifications = userIds.map((userId) => ({
      userId,
      userModel,
      type,
      content,
      navigatePath,
    }));

    const createdNotifications =
      await this.notificationModel.insertMany(notifications);

    return createdNotifications;
  }
}

