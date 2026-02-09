import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export type AuditEntityType = 'hotel' | 'user' | 'subscription' | 'verification' | 'auth';

export interface IAuditLog extends Document {
    actorId: Types.ObjectId;
    actorRole: string;
    action: string;
    entityType: AuditEntityType;
    entityId?: Types.ObjectId | null;
    targetUserId?: Types.ObjectId | null;
    targetHotelId?: Types.ObjectId | null;
    ip?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
    {
        actorId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        actorRole: {
            type: String,
            required: true,
            trim: true,
        },
        action: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        entityType: {
            type: String,
            enum: ['hotel', 'user', 'subscription', 'verification', 'auth'],
            required: true,
            index: true,
        },
        entityId: {
            type: Schema.Types.ObjectId,
            default: null,
            index: true,
        },
        targetUserId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null,
            index: true,
        },
        targetHotelId: {
            type: Schema.Types.ObjectId,
            ref: 'Hotel',
            default: null,
            index: true,
        },
        ip: {
            type: String,
            trim: true,
            default: '',
        },
        userAgent: {
            type: String,
            trim: true,
            default: '',
        },
        metadata: {
            type: Schema.Types.Mixed,
            default: {},
        },
    },
    {
        timestamps: true,
    }
);

AuditLogSchema.index({ actorId: 1, createdAt: -1 });
AuditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });

export const AuditLog: Model<IAuditLog> =
    mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);

