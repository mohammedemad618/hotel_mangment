import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken, extractTokenFromRequest } from '../auth/jwt';
import { hasPermission, Permission } from '../auth/roles';
import { UserRole } from '../db/models';
import { runWithTenant } from '../db/tenantMiddleware';

// ========================================
// Auth Context Type
// ========================================

export interface AuthContext {
    userId: string;
    hotelId: string | null;
    role: UserRole;
    permissions: string[];
}

// ========================================
// Authentication Middleware
// ========================================

export type AuthenticatedHandler = (
    request: NextRequest,
    context: { params: Promise<Record<string, string>> },
    auth: AuthContext
) => Promise<NextResponse>;

export function withAuth(handler: AuthenticatedHandler) {
    return async (
        request: NextRequest,
        context: { params: Promise<Record<string, string>> }
    ): Promise<NextResponse> => {
        const token = extractTokenFromRequest(request);

        if (!token) {
            return NextResponse.json(
                { error: 'غير مصادق عليه - يرجى تسجيل الدخول' },
                { status: 401 }
            );
        }

        const payload = await verifyAccessToken(token);

        if (!payload) {
            return NextResponse.json(
                { error: 'رمز غير صالح أو منتهي الصلاحية' },
                { status: 401 }
            );
        }

        const auth: AuthContext = {
            userId: payload.sub,
            hotelId: payload.hotelId,
            role: payload.role as UserRole,
            permissions: payload.permissions,
        };

        // Add auth info to request headers for downstream use
        const requestWithAuth = new NextRequest(request.url, {
            method: request.method,
            headers: new Headers(request.headers),
            body: request.body,
        });
        requestWithAuth.headers.set('x-user-id', auth.userId);
        if (auth.hotelId) {
            requestWithAuth.headers.set('x-hotel-id', auth.hotelId);
        }
        requestWithAuth.headers.set('x-user-role', auth.role);

        return handler(requestWithAuth, context, auth);
    };
}

// ========================================
// Permission Middleware
// ========================================

export function withPermission(
    requiredPermission: Permission,
    handler: AuthenticatedHandler
) {
    return withTenant(async (request, context, auth) => {
        if (!hasPermission(auth.role, auth.permissions, requiredPermission)) {
            return NextResponse.json(
                { error: 'غير مصرح - ليس لديك الصلاحية لهذا الإجراء' },
                { status: 403 }
            );
        }

        return handler(request, context, auth);
    });
}

// ========================================
// Role Middleware
// ========================================

export function withRole(
    allowedRoles: UserRole[],
    handler: AuthenticatedHandler
) {
    return withAuth(async (request, context, auth) => {
        if (!allowedRoles.includes(auth.role)) {
            return NextResponse.json(
                { error: 'غير مصرح - دورك لا يسمح بهذا الإجراء' },
                { status: 403 }
            );
        }

        return handler(request, context, auth);
    });
}

// ========================================
// Super Admin Only Middleware
// ========================================

export function withSuperAdmin(handler: AuthenticatedHandler) {
    return withRole(['super_admin'], handler);
}

// ========================================
// Tenant Middleware
// ========================================

export function withTenant(handler: AuthenticatedHandler) {
    return withAuth(async (request, context, auth) => {
        let effectiveHotelId = auth.hotelId;

        if (!effectiveHotelId && auth.role === 'super_admin') {
            const url = new URL(request.url);
            effectiveHotelId =
                request.headers.get('x-hotel-id') ||
                url.searchParams.get('hotelId');
        }

        if (!effectiveHotelId) {
            return NextResponse.json(
                { error: 'غير مصرح - لم يتم تحديد الفندق' },
                { status: 403 }
            );
        }

        if (!/^[a-f\d]{24}$/i.test(effectiveHotelId)) {
            return NextResponse.json(
                { error: 'معرف الفندق غير صالح' },
                { status: 400 }
            );
        }

        return runWithTenant(effectiveHotelId, () =>
            handler(request, context, { ...auth, hotelId: effectiveHotelId })
        );
    });
}
