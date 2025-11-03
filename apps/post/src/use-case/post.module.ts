import { Module, Post } from '@nestjs/common';
import { PostService } from '../service/post.service';
import { PostController } from '../controller/post.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import config from 'apps/config/config';
import { MongooseModule } from '@nestjs/mongoose';
import { PostSchema } from '../core/schema/post.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [config],
    }),
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
      connectionName: 'userConnection',
    }),
    MongooseModule.forFeature(
      [{ name: Post.name, schema: PostSchema }],
      'userConnection',
    ),],
  controllers: [PostController],
  providers: [PostService],
})
export class PostModule { }
