import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { tenantPlugin } from '../tenantMiddleware';

// ========================================
// Guest Model
// ========================================

export type GuestType = 'individual' | 'corporate' | 'vip';

export interface IGuest extends Document {
    hotelId: Types.ObjectId;
    firstName: string;
    lastName: string;
    email?: string;
    phone: string;
    nationality: string;
    idType: 'passport' | 'national_id' | 'driver_license';
    idNumber: string;
    dateOfBirth?: Date;
    address?: {
        street: string;
        city: string;
        country: string;
    };
    guestType: GuestType;
    companyName?: string;
    notes?: string;
    totalStays: number;
    totalSpent: number;
    lastStay?: Date;
    isBlacklisted: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const GuestSchema = new Schema<IGuest>(
    {
        hotelId: {
            type: Schema.Types.ObjectId,
            ref: 'Hotel',
            required: [true, 'معرف الفندق مطلوب'],
            index: true,
        },
        firstName: {
            type: String,
            required: [true, 'الاسم الأول مطلوب'],
            trim: true,
            maxlength: [50, 'الاسم الأول لا يمكن أن يتجاوز 50 حرف'],
        },
        lastName: {
            type: String,
            required: [true, 'الاسم الأخير مطلوب'],
            trim: true,
            maxlength: [50, 'الاسم الأخير لا يمكن أن يتجاوز 50 حرف'],
        },
        email: {
            type: String,
            lowercase: true,
            trim: true,
        },
        phone: {
            type: String,
            required: [true, 'رقم الهاتف مطلوب'],
            trim: true,
        },
        nationality: {
            type: String,
            required: [true, 'الجنسية مطلوبة'],
        },
        idType: {
            type: String,
            enum: ['passport', 'national_id', 'driver_license'],
            required: [true, 'نوع الهوية مطلوب'],
        },
        idNumber: {
            type: String,
            required: [true, 'رقم الهوية مطلوب'],
        },
        dateOfBirth: {
            type: Date,
        },
        address: {
            street: { type: String },
            city: { type: String },
            country: { type: String },
        },
        guestType: {
            type: String,
            enum: ['individual', 'corporate', 'vip'],
            default: 'individual',
        },
        companyName: {
            type: String,
            trim: true,
        },
        notes: {
            type: String,
            maxlength: [1000, 'الملاحظات لا يمكن أن تتجاوز 1000 حرف'],
        },
        totalStays: {
            type: Number,
            default: 0,
            min: 0,
        },
        totalSpent: {
            type: Number,
            default: 0,
            min: 0,
        },
        lastStay: {
            type: Date,
        },
        isBlacklisted: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

GuestSchema.plugin(tenantPlugin);

// Compound indexes
GuestSchema.index({ hotelId: 1, idNumber: 1 });
GuestSchema.index({ hotelId: 1, phone: 1 });
GuestSchema.index({ hotelId: 1, email: 1 });
GuestSchema.index({ hotelId: 1, lastName: 1, firstName: 1 });
GuestSchema.index({ hotelId: 1, guestType: 1 });

// Virtual for full name
GuestSchema.virtual('fullName').get(function () {
    return `${this.firstName} ${this.lastName}`;
});

export const Guest: Model<IGuest> =
    mongoose.models.Guest || mongoose.model<IGuest>('Guest', GuestSchema);
