import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';


@Schema({ timestamps: true })
export class Notification extends Document {
  @Prop({ type: mongoose.Schema.Types.ObjectId, required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, required: true, enum: ['User', 'Doctor'] })
  userModel: string;

  @Prop({ type: String, required: true, enum: ['ForPost', 'ForAppointment'] })
  type: string;

  @Prop({ required: true })
  content: string;

  @Prop({ required: true })
  navigatePath: string;

  @Prop({ default: false })
  isRead: boolean;

  @Prop({ type: Date, default: Date.now })
  readAt?: Date;

  @Prop({ default: false })
  isDeleted: boolean;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

