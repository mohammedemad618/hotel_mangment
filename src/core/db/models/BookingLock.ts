import mongoose, { Schema, Document, Model, Types } from 'mongoose';

// Short-lived per-room lock to avoid concurrent overbooking writes.
export interface IBookingLock extends Document {
    roomId: Types.ObjectId;
    hotelId: Types.ObjectId;
    owner: string;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

const BookingLockSchema = new Schema<IBookingLock>(
    {
        roomId: {
            type: Schema.Types.ObjectId,
            ref: 'Room',
            required: true,
            unique: true,
            index: true,
        },
        hotelId: {
            type: Schema.Types.ObjectId,
            ref: 'Hotel',
            required: true,
            index: true,
        },
        owner: {
            type: String,
            required: true,
            trim: true,
            maxlength: 120,
        },
        expiresAt: {
            type: Date,
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

BookingLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const BookingLock: Model<IBookingLock> =
    mongoose.models.BookingLock || mongoose.model<IBookingLock>('BookingLock', BookingLockSchema);
