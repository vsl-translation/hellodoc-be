import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class SignLanguage extends Document {
  @Prop({ required: true, unique: true })
  urlMedia: string;
  @Prop({ required: true })
  signLanguage: string[];
}

export const SignLanguageSchema =
  SchemaFactory.createForClass(SignLanguage);