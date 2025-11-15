import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { CreateNotificationDto } from '../core/dto/notification.dto';
import { UpdateNotificationDto } from '../core/dto/update-notification.dto';
import { SendBulkNotificationDto } from '../core/dto/send-bulk-notification.dto';

@Injectable()
export class NotificationService {
  constructor(
    @Inject('NOTIFICATION_CLIENT') private notificationClient: ClientProxy,
  ) {}

  createNotification(createNotificationDto: CreateNotificationDto) {
    return this.notificationClient.send(
      'notification.create',
      createNotificationDto,
    );
  }

  getNotificationsByUser(userId: string) {
    return this.notificationClient.send('notification.getByUser', userId);
  }

  getUnreadNotifications(userId: string) {
    return this.notificationClient.send('notification.getUnread', userId);
  }

  getUnreadCount(userId: string) {
    return this.notificationClient.send('notification.getUnreadCount', userId);
  }

  markAsRead(id: string) {
    return this.notificationClient.send('notification.markAsRead', id);
  }

  markAllAsRead(userId: string) {
    return this.notificationClient.send('notification.markAllAsRead', userId);
  }

  deleteNotification(id: string) {
    return this.notificationClient.send('notification.delete', id);
  }

  getNotificationById(id: string) {
    return this.notificationClient.send('notification.getById', id);
  }

  updateNotification(id: string, updateDto: UpdateNotificationDto) {
    return this.notificationClient.send('notification.update', {
      id,
      updateDto,
    });
  }

  sendBulkNotifications(sendBulkNotificationDto: SendBulkNotificationDto) {
    return this.notificationClient.send('notification.sendBulk', sendBulkNotificationDto);
  }
}

