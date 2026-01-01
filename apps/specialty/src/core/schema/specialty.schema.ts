import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, mongo, Types } from 'mongoose';

@Schema({ collection: 'specialties' })
export class Specialty extends Document {
    @Prop({ required: true })
    name: string;

    @Prop()
    icon: string;

    @Prop()
    description: string;

    @Prop({ type: [{ type: mongoose.Schema.Types.ObjectId }], default: [] })
    doctors: Types.ObjectId[]; // Danh sách bác sĩ thuộc chuyên khoa
}

export const SpecialtySchema = SchemaFactory.createForClass(Specialty);
