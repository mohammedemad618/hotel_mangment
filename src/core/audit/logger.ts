import mongoose from 'mongoose';
import { NextRequest } from 'next/server';
import { AuditLog, AuditEntityType } from '@/core/db/models';
import { AuthContext } from '@/core/middleware/auth';

interface AuditLogInput {
    request: NextRequest;
    auth: AuthContext;
    action: string;
    entityType: AuditEntityType;
    entityId?: string | mongoose.Types.ObjectId | null;
    targetUserId?: string | mongoose.Types.ObjectId | null;
    targetHotelId?: string | mongoose.Types.ObjectId | null;
    metadata?: Record<string, unknown>;
}

function toObjectId(value?: string | mongoose.Types.ObjectId | null): mongoose.Types.ObjectId | null {
    if (!value) return null;
    if (value instanceof mongoose.Types.ObjectId) return value;
    if (!mongoose.Types.ObjectId.isValid(value)) return null;
    return new mongoose.Types.ObjectId(value);
}

function getClientIp(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    return request.headers.get('x-real-ip') || '';
}

export async function writeAuditLog(input: AuditLogInput): Promise<void> {
    try {
        const actorId = toObjectId(input.auth.userId);
        if (!actorId) return;

        await AuditLog.create({
            actorId,
            actorRole: input.auth.role,
            action: input.action,
            entityType: input.entityType,
            entityId: toObjectId(input.entityId),
            targetUserId: toObjectId(input.targetUserId),
            targetHotelId: toObjectId(input.targetHotelId),
            ip: getClientIp(input.request),
            userAgent: requestUserAgent(input.request),
            metadata: input.metadata || {},
        });
    } catch (error) {
        console.error('Write audit log error:', error);
    }
}

function requestUserAgent(request: NextRequest): string {
    return request.headers.get('user-agent') || '';
}

