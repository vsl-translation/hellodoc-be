import { Body, Controller, Param } from '@nestjs/common';
import { NotificationService } from '../service/notification.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CreateNotificationDto } from '../core/dto/create-notification.dto';
import { UpdateNotificationDto } from '../core/dto/update-notification.dto';
import { SendBulkNotificationDto } from '../core/dto/send-bulk-notification.dto';

@Controller()
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @MessagePattern('notification.create')
  async createNotification(@Body() createNotificationDto: CreateNotificationDto) {
    return await this.notificationService.createNotification(createNotificationDto);
  }

  @MessagePattern('notification.getByUser')
  async getNotificationsByUser(@Payload() userId: string) {
    return await this.notificationService.getNotificationsByUser(userId);
  }

  @MessagePattern('notification.getUnread')
  async getUnreadNotifications(@Payload() userId: string) {
    return await this.notificationService.getUnreadNotifications(userId);
  }

  @MessagePattern('notification.getUnreadCount')
  async getUnreadCount(@Payload() userId: string) {
    return await this.notificationService.getUnreadCount(userId);
  }

  @MessagePattern('notification.markAsRead')
  async markAsRead(@Payload() id: string) {
    return await this.notificationService.markAsRead(id);
  }

  @MessagePattern('notification.markAllAsRead')
  async markAllAsRead(@Payload() userId: string) {
    return await this.notificationService.markAllAsRead(userId);
  }

  @MessagePattern('notification.delete')
  async deleteNotification(@Payload() id: string) {
    return await this.notificationService.deleteNotification(id);
  }

  @MessagePattern('notification.getById')
  async getNotificationById(@Payload() id: string) {
    return await this.notificationService.getNotificationById(id);
  }

  @MessagePattern('notification.update')
  async updateNotification(
    @Payload() data: { id: string; updateDto: UpdateNotificationDto },
  ) {
    const { id, updateDto } = data;
    return await this.notificationService.updateNotification(id, updateDto);
  }

  @MessagePattern('notification.sendBulk')
  async sendBulkNotifications(
    @Body() sendBulkNotificationDto: SendBulkNotificationDto,
  ) {
    return await this.notificationService.sendBulkNotifications(sendBulkNotificationDto);
  }
}

