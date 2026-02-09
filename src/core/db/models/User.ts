import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import type { IHotel } from './Hotel';
import { tenantPlugin } from '../tenantMiddleware';

// ========================================
// User Model
// ========================================

export type UserRole =
    | 'super_admin'
    | 'sub_super_admin'
    | 'admin'
    | 'manager'
    | 'receptionist'
    | 'housekeeping'
    | 'accountant';

export interface IUser extends Document {
    hotelId: Types.ObjectId | null; // null for platform-level admins (super/sub-super)
    createdBy?: Types.ObjectId | null;
    verification: {
        isVerified: boolean;
        verifiedBy?: Types.ObjectId | null;
        verifiedAt?: Date | null;
    };
    hotel?: IHotel | null;
    email: string;
    passwordHash: string;
    name: string;
    phone?: string;
    role: UserRole;
    permissions: string[];
    isActive: boolean;
    mfaEnabled: boolean;
    mfaSecret?: string;
    lastLogin?: Date;
    refreshTokenHash?: string;
    passwordChangedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
    {
        hotelId: {
            type: Schema.Types.ObjectId,
            ref: 'Hotel',
            default: null,
            index: true,
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null,
            index: true,
        },
        verification: {
            isVerified: { type: Boolean, default: false, index: true },
            verifiedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
            verifiedAt: { type: Date, default: null },
        },
        email: {
            type: String,
            required: [true, 'البريد الإلكتروني مطلوب'],
            lowercase: true,
            trim: true,
        },
        passwordHash: {
            type: String,
            required: [true, 'كلمة المرور مطلوبة'],
            select: false,
        },
        name: {
            type: String,
            required: [true, 'الاسم مطلوب'],
            trim: true,
            maxlength: [100, 'الاسم لا يمكن أن يتجاوز 100 حرف'],
        },
        phone: {
            type: String,
            trim: true,
        },
        role: {
            type: String,
            enum: ['super_admin', 'sub_super_admin', 'admin', 'manager', 'receptionist', 'housekeeping', 'accountant'],
            required: true,
        },
        permissions: [{
            type: String,
        }],
        isActive: {
            type: Boolean,
            default: true,
        },
        mfaEnabled: {
            type: Boolean,
            default: false,
        },
        mfaSecret: {
            type: String,
            select: false,
        },
        lastLogin: {
            type: Date,
        },
        refreshTokenHash: {
            type: String,
            select: false,
        },
        passwordChangedAt: {
            type: Date,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

UserSchema.plugin(tenantPlugin);

// Compound unique index: email is unique per hotel (or globally for platform-level admins)
UserSchema.index({ hotelId: 1, email: 1 }, { unique: true });
UserSchema.index({ role: 1 });
UserSchema.index({ isActive: 1 });

// Virtual for hotel reference
UserSchema.virtual('hotel', {
    ref: 'Hotel',
    localField: 'hotelId',
    foreignField: '_id',
    justOne: true,
});

export const User: Model<IUser> =
    mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
