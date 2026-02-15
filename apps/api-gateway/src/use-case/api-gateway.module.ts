import { Module } from '@nestjs/common';
import { ApiGatewayController } from '../controller/api-gateway.controller';
import { ApiGatewayService } from '../services/api-gateway.service';
import { UsersModule } from './users.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import config from '../config';
import { MongooseModule } from '@nestjs/mongoose';
import { CacheModule } from '@nestjs/cache-manager';
import KeyvRedis from '@keyv/redis';
import { JwtModule } from '@nestjs/jwt';
import { DoctorModule } from './doctor.module';
import { NewsModule } from './news.module';
import { AuthModule } from './auth.module';
import { Neo4jModule } from './neo4j.module';
import { AppointmentModule } from './appointment.module';
import { SpecialtyModule } from './specialty.module';
import { NotificationModule } from './notification.module';
import { PostModule } from './post.module';
import { MediaModule } from './media.module';
import { QdrantModule } from './qdrant.module';
import { EmbeddingModule } from './embedding.module';
import { AdminModule } from './admin.module';
import { MedicalOptionModule } from './medical_option.module';
import { PostFavoriteModule } from './post-favorite.module';
import { NewsFavoriteModule } from './news-favorite.module';
import { NewsCommentModule } from './news-comment.module';
import { ReportModule } from './report.module';
import { ReviewModule } from './review.module';
import { PostCommentModule } from './post-comment.module';
import { UndertheseaModule } from './underthesea.module';
import { NlpIntegrationModule } from './nlp-integration.module';
import { ImageCaptionModule } from './image-caption.module';
import { PhowhisperModule } from './phowhisper.module';
import { SocketModule } from '../socket/socket.module';
import { SignLanguageModule } from './sign-language.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [config],
    }),
    JwtModule.register({ global: true, secret: "secretKey" }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const isDev = configService.get<string>('isDev') === 'true';
        const uri = isDev
          ? configService.get<string>('MONGO_URI_DEV')
          : configService.get<string>('MONGO_URI_PROD');

        return { uri };
      },
      inject: [ConfigService],
    }),
    CacheModule.register({
      // @ts-ignore
      store: new KeyvRedis('rediss://red-d071mk9r0fns7383v3j0:DeNbSrFT3rDj2vhGDGoX4Pr2DgHUBP8H@singapore-keyvalue.render.com:6379'),
      ttl: 3600 * 1000,
      isGlobal: true,
    }),
    UsersModule,
    DoctorModule,
    NewsModule,
    AuthModule,
    AppointmentModule,
    PostModule,
    SpecialtyModule,
    Neo4jModule,
    NotificationModule,
    AdminModule,
    MedicalOptionModule,
    MediaModule,
    QdrantModule,
    EmbeddingModule,
    PostFavoriteModule,
    NewsFavoriteModule,
    NewsCommentModule,
    ReportModule,
    ReviewModule,
    PostCommentModule,
    UndertheseaModule,
    NlpIntegrationModule,
    ImageCaptionModule,
    PhowhisperModule,
    SignLanguageModule,
    SocketModule
  ],
  controllers: [ApiGatewayController],
  providers: [ApiGatewayService],
})
export class ApiGatewayModule { }
