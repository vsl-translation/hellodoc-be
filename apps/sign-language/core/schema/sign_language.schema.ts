// apps/sign-language/core/schema/video.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'videos' })
export class Video extends Document {
  @Prop({ required: true, unique: true, index: true })
  videoUrl: string;

  @Prop({ type: String })
  wordCodes: string;

  @Prop({ type: [String] })
  processedWords: string[]; // Original words for quick reference

  @Prop()
  subtitleText: string;

  @Prop({ default: 0 })
  totalProcessingTime: number; // in milliseconds
}

export const VideoSchema = SchemaFactory.createForClass(Video);