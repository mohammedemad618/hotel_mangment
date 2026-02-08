import mongoose, { Schema, Document, Model } from 'mongoose';

// ========================================
// Hotel (Tenant) Model
// ========================================

export interface IHotel extends Document {
    name: string;
    slug: string;
    email: string;
    phone: string;
    address: {
        street: string;
        city: string;
        country: string;
        postalCode: string;
    };
    subscription: {
        plan: 'free' | 'basic' | 'premium' | 'enterprise';
        status: 'active' | 'suspended' | 'cancelled';
        startDate: Date;
        endDate: Date | null;
    };
    settings: {
        currency: string;
        timezone: string;
        language: 'ar' | 'en';
        checkInTime: string;
        checkOutTime: string;
        taxRate: number;
        theme?: 'light' | 'dark' | 'system';
        notifications?: {
            newBooking: boolean;
            cancelledBooking: boolean;
            paymentReceived: boolean;
            dailyReport: boolean;
        };
    };
    notificationsLog?: Array<{
        type: 'booking_new' | 'booking_cancelled' | 'payment_received' | 'daily_report';
        message: string;
        createdAt: Date;
    }>;
    logo?: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const HotelSchema = new Schema<IHotel>(
    {
        name: {
            type: String,
            required: [true, 'اسم الفندق مطلوب'],
            trim: true,
            maxlength: [100, 'اسم الفندق لا يمكن أن يتجاوز 100 حرف'],
        },
        slug: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        email: {
            type: String,
            required: [true, 'البريد الإلكتروني مطلوب'],
            unique: true,
            lowercase: true,
            trim: true,
        },
        phone: {
            type: String,
            required: [true, 'رقم الهاتف مطلوب'],
            trim: true,
        },
        address: {
            street: { type: String, default: '' },
            city: { type: String, required: true },
            country: { type: String, required: true },
            postalCode: { type: String, default: '' },
        },
        subscription: {
            plan: {
                type: String,
                enum: ['free', 'basic', 'premium', 'enterprise'],
                default: 'free',
            },
            status: {
                type: String,
                enum: ['active', 'suspended', 'cancelled'],
                default: 'active',
            },
            startDate: { type: Date, default: Date.now },
            endDate: { type: Date, default: null },
        },
        settings: {
            currency: { type: String, default: 'SAR' },
            timezone: { type: String, default: 'Asia/Riyadh' },
            language: { type: String, enum: ['ar', 'en'], default: 'ar' },
            checkInTime: { type: String, default: '14:00' },
            checkOutTime: { type: String, default: '12:00' },
            taxRate: { type: Number, default: 15, min: 0, max: 30 },
            theme: { type: String, enum: ['light', 'dark', 'system'], default: 'dark' },
            notifications: {
                newBooking: { type: Boolean, default: true },
                cancelledBooking: { type: Boolean, default: true },
                paymentReceived: { type: Boolean, default: true },
                dailyReport: { type: Boolean, default: true },
            },
        },
        notificationsLog: [
            {
                type: {
                    type: String,
                    enum: ['booking_new', 'booking_cancelled', 'payment_received', 'daily_report'],
                },
                message: { type: String, required: true },
                createdAt: { type: Date, default: Date.now },
            },
        ],
        logo: { type: String },
        isActive: { type: Boolean, default: true },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Indexes
HotelSchema.index({ isActive: 1 });
HotelSchema.index({ 'subscription.status': 1 });

export const Hotel: Model<IHotel> =
    mongoose.models.Hotel || mongoose.model<IHotel>('Hotel', HotelSchema);
