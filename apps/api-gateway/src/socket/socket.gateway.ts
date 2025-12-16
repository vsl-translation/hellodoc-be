import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
@Injectable()
export class SocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger = new Logger(SocketGateway.name);

  constructor(
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
    private jwtService: JwtService,
  ) {
    this.logger.log('✅ SocketGateway initialized');
  }

  // ==============================
  // HANDLE CONNECT
  // ==============================
  async handleConnection(client: Socket) {
    this.logger.warn(`🔌 Incoming socket: ${client.id}`);

    try {
      const token =
        client.handshake.headers.authorization?.split(' ')[1] ||
        (client.handshake.query.token as string);

      this.logger.warn(`🔑 Token received: ${token ? 'YES' : 'NO'}`);

      if (!token) {
        this.logger.warn('❌ No token → disconnect');
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      this.logger.warn(`📦 JWT payload: ${JSON.stringify(payload)}`);

      // ===== MAP USER ID =====
      const userId =
        payload.userId || payload.sub || payload._id || payload.id;

      // ===== MAP ROLE (SAFE) =====
      const rawRole = String(payload.role || '').toLowerCase();

      const roleMap: Record<string, string> = {
        admin: 'ADMIN',
        user: 'USER',
        blind: 'USER',
        doctor: 'DOCTOR',
      };

      const role = roleMap[rawRole];

      this.logger.warn(
        `🧩 Parsed userId=${userId}, rawRole=${payload.role}, role=${role}`,
      );

      if (!userId || !role) {
        this.logger.warn('❌ Invalid JWT payload → disconnect');
        client.disconnect();
        return;
      }

      client['user'] = { userId, role };

      // ===== SET ONLINE =====
      await this.setUserOnline(userId, role);

      // ===== ADMIN JOIN ROOM =====
      if (role === 'ADMIN') {
        client.join('admin');
        this.logger.warn(
          `👑 ADMIN joined room | rooms=${Array.from(client.rooms).join(',')}`,
        );
      }

      await this.updateAdminStats();

      this.logger.log(
        `✅ Socket connected: ${userId} (${role}) | ${client.id}`,
      );
    } catch (e) {
      this.logger.error(`🔥 Socket auth error: ${e.message}`);
      client.disconnect();
    }
  }

  // ==============================
  // HANDLE DISCONNECT
  // ==============================
  async handleDisconnect(client: Socket) {
    const user = client['user'];

    if (!user) {
      this.logger.warn(`❓ Disconnect unknown socket ${client.id}`);
      return;
    }

    await this.setUserOffline(user.userId, user.role);
    await this.updateAdminStats();

    this.logger.warn(
      `🔌 Socket disconnected: ${user.userId} (${user.role}) | ${client.id}`,
    );
  }

  // ==============================
  // REDIS HELPERS
  // ==============================
  private async setUserOnline(userId: string, role: string) {
    if (!this.redisClient) {
      this.logger.error('❌ Redis client not available');
      return;
    }

    try {
      switch (role) {
        case 'USER':
          await this.redisClient.sadd('online_users', userId);
          this.logger.warn(`🟢 USER ONLINE: ${userId}`);
          break;
        case 'DOCTOR':
          await this.redisClient.sadd('online_doctors', userId);
          this.logger.warn(`🟢 DOCTOR ONLINE: ${userId}`);
          break;
        case 'ADMIN':
          this.logger.warn(`ℹ️ ADMIN connected (not counted)`);
          break;
      }
    } catch (e) {
      this.logger.error(`❌ Redis error in setUserOnline: ${e.message}`);
    }
  }

  private async setUserOffline(userId: string, role: string) {
    if (!this.redisClient) return;

    try {
      switch (role) {
        case 'USER':
          await this.redisClient.srem('online_users', userId);
          this.logger.warn(`🔴 USER OFFLINE: ${userId}`);
          break;
        case 'DOCTOR':
          await this.redisClient.srem('online_doctors', userId);
          this.logger.warn(`🔴 DOCTOR OFFLINE: ${userId}`);
          break;
      }
    } catch (e) {
      this.logger.error(`❌ Redis error in setUserOffline: ${e.message}`);
    }
  }

  // ==============================
  // ADMIN STATS
  // ==============================
  private async updateAdminStats() {
    if (!this.redisClient) return;

    try {
      const [
        onlineUsersCount,
        onlineDoctorsCount,
        onlineUsers,
        onlineDoctors,
      ] = await Promise.all([
        this.redisClient.scard('online_users'),
        this.redisClient.scard('online_doctors'),
        this.redisClient.smembers('online_users'),
        this.redisClient.smembers('online_doctors'),
      ]);

      this.server.to('admin').emit('online_stats', {
        users: onlineUsersCount,
        doctors: onlineDoctorsCount,
        userIds: onlineUsers,
        doctorIds: onlineDoctors,
      });
    } catch (e) {
      this.logger.error(`❌ Redis error in updateAdminStats: ${e.message}`);
    }
  }
}
