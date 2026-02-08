import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { tenantPlugin } from '../tenantMiddleware';

// ========================================
// Booking Model
// ========================================

export type BookingStatus =
    | 'pending'
    | 'confirmed'
    | 'checked_in'
    | 'checked_out'
    | 'cancelled'
    | 'no_show';

export type PaymentStatus = 'pending' | 'partial' | 'paid' | 'refunded';

export interface IBooking extends Document {
    hotelId: Types.ObjectId;
    bookingNumber: string;
    roomId: Types.ObjectId;
    guestId: Types.ObjectId;
    checkInDate: Date;
    checkOutDate: Date;
    actualCheckIn?: Date;
    actualCheckOut?: Date;
    numberOfGuests: {
        adults: number;
        children: number;
    };
    status: BookingStatus;
    source: 'direct' | 'website' | 'phone' | 'walkin' | 'ota';
    pricing: {
        roomRate: number;
        numberOfNights: number;
        subtotal: number;
        taxes: number;
        discount: number;
        total: number;
    };
    payment: {
        status: PaymentStatus;
        method?: 'cash' | 'card' | 'bank_transfer' | 'online';
        paidAmount: number;
        transactions: Array<{
            amount: number;
            method: string;
            date: Date;
            reference?: string;
        }>;
    };
    specialRequests?: string;
    notes?: string;
    createdBy: Types.ObjectId;
    lastModifiedBy?: Types.ObjectId;
    cancelledAt?: Date;
    cancellationReason?: string;
    createdAt: Date;
    updatedAt: Date;
}

const BookingSchema = new Schema<IBooking>(
    {
        hotelId: {
            type: Schema.Types.ObjectId,
            ref: 'Hotel',
            required: [true, 'معرف الفندق مطلوب'],
            index: true,
        },
        bookingNumber: {
            type: String,
            required: true,
            trim: true,
        },
        roomId: {
            type: Schema.Types.ObjectId,
            ref: 'Room',
            required: [true, 'الغرفة مطلوبة'],
        },
        guestId: {
            type: Schema.Types.ObjectId,
            ref: 'Guest',
            required: [true, 'النزيل مطلوب'],
        },
        checkInDate: {
            type: Date,
            required: [true, 'تاريخ الوصول مطلوب'],
        },
        checkOutDate: {
            type: Date,
            required: [true, 'تاريخ المغادرة مطلوب'],
        },
        actualCheckIn: {
            type: Date,
        },
        actualCheckOut: {
            type: Date,
        },
        numberOfGuests: {
            adults: { type: Number, required: true, min: 1 },
            children: { type: Number, default: 0, min: 0 },
        },
        status: {
            type: String,
            enum: ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'],
            default: 'pending',
        },
        source: {
            type: String,
            enum: ['direct', 'website', 'phone', 'walkin', 'ota'],
            default: 'direct',
        },
        pricing: {
            roomRate: { type: Number, required: true, min: 0 },
            numberOfNights: { type: Number, required: true, min: 1 },
            subtotal: { type: Number, required: true, min: 0 },
            taxes: { type: Number, default: 0, min: 0 },
            discount: { type: Number, default: 0, min: 0 },
            total: { type: Number, required: true, min: 0 },
        },
        payment: {
            status: {
                type: String,
                enum: ['pending', 'partial', 'paid', 'refunded'],
                default: 'pending',
            },
            method: {
                type: String,
                enum: ['cash', 'card', 'bank_transfer', 'online'],
            },
            paidAmount: { type: Number, default: 0, min: 0 },
            transactions: [{
                amount: { type: Number, required: true },
                method: { type: String, required: true },
                date: { type: Date, default: Date.now },
                reference: { type: String },
            }],
        },
        specialRequests: {
            type: String,
            maxlength: [500, 'الطلبات الخاصة لا يمكن أن تتجاوز 500 حرف'],
        },
        notes: {
            type: String,
            maxlength: [1000, 'الملاحظات لا يمكن أن تتجاوز 1000 حرف'],
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        lastModifiedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
        cancelledAt: {
            type: Date,
        },
        cancellationReason: {
            type: String,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

BookingSchema.plugin(tenantPlugin);

// Compound indexes
BookingSchema.index({ hotelId: 1, bookingNumber: 1 }, { unique: true });
BookingSchema.index({ hotelId: 1, status: 1 });
BookingSchema.index({ hotelId: 1, roomId: 1, checkInDate: 1, checkOutDate: 1 });
BookingSchema.index({ hotelId: 1, guestId: 1 });
BookingSchema.index({ hotelId: 1, checkInDate: 1 });
BookingSchema.index({ hotelId: 1, 'payment.status': 1 });
BookingSchema.index({ hotelId: 1, createdAt: -1 });

// Virtuals
BookingSchema.virtual('room', {
    ref: 'Room',
    localField: 'roomId',
    foreignField: '_id',
    justOne: true,
});

BookingSchema.virtual('guest', {
    ref: 'Guest',
    localField: 'guestId',
    foreignField: '_id',
    justOne: true,
});

// Pre-validate: Generate booking number before required validation
BookingSchema.pre('validate', function (next) {
    if (this.isNew && !this.bookingNumber) {
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        this.bookingNumber = `BK${year}${month}${random}`;
    }
    next();
});

export const Booking: Model<IBooking> =
    mongoose.models.Booking || mongoose.model<IBooking>('Booking', BookingSchema);
