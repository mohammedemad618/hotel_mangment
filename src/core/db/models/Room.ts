import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { tenantPlugin } from '../tenantMiddleware';

// ========================================
// Room Model
// ========================================

export type RoomType = 'single' | 'double' | 'twin' | 'suite' | 'deluxe' | 'presidential';
export type RoomStatus = 'available' | 'occupied' | 'reserved' | 'maintenance' | 'cleaning';

export interface IRoom extends Document {
    hotelId: Types.ObjectId;
    roomNumber: string;
    floor: number;
    type: RoomType;
    status: RoomStatus;
    pricePerNight: number;
    capacity: {
        adults: number;
        children: number;
    };
    amenities: string[];
    images: string[];
    description?: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const RoomSchema = new Schema<IRoom>(
    {
        hotelId: {
            type: Schema.Types.ObjectId,
            ref: 'Hotel',
            required: [true, 'معرف الفندق مطلوب'],
            index: true,
        },
        roomNumber: {
            type: String,
            required: [true, 'رقم الغرفة مطلوب'],
            trim: true,
        },
        floor: {
            type: Number,
            required: [true, 'رقم الطابق مطلوب'],
            min: [0, 'رقم الطابق يجب أن يكون 0 أو أكثر'],
        },
        type: {
            type: String,
            enum: ['single', 'double', 'twin', 'suite', 'deluxe', 'presidential'],
            required: [true, 'نوع الغرفة مطلوب'],
        },
        status: {
            type: String,
            enum: ['available', 'occupied', 'reserved', 'maintenance', 'cleaning'],
            default: 'available',
        },
        pricePerNight: {
            type: Number,
            required: [true, 'سعر الليلة مطلوب'],
            min: [0, 'السعر لا يمكن أن يكون سالباً'],
        },
        capacity: {
            adults: { type: Number, default: 2, min: 1 },
            children: { type: Number, default: 0, min: 0 },
        },
        amenities: [{
            type: String,
            trim: true,
        }],
        images: [{
            type: String,
        }],
        description: {
            type: String,
            maxlength: [500, 'الوصف لا يمكن أن يتجاوز 500 حرف'],
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

RoomSchema.plugin(tenantPlugin);

// Compound indexes
RoomSchema.index({ hotelId: 1, roomNumber: 1 }, { unique: true });
RoomSchema.index({ hotelId: 1, status: 1 });
RoomSchema.index({ hotelId: 1, type: 1 });
RoomSchema.index({ hotelId: 1, floor: 1 });

// Virtual for hotel reference
RoomSchema.virtual('hotel', {
    ref: 'Hotel',
    localField: 'hotelId',
    foreignField: '_id',
    justOne: true,
});

export const Room: Model<IRoom> =
    mongoose.models.Room || mongoose.model<IRoom>('Room', RoomSchema);
