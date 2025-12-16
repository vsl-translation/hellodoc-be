import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class VideoSubtitle extends Document {
  @Prop({ required: true, unique: true })
  videoUrl: string;

  @Prop({ required: true })
  subtitleUrl: string;
}

export const VideoSubtitleSchema =
  SchemaFactory.createForClass(VideoSubtitle);
