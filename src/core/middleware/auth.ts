import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken, extractTokenFromRequest } from '../auth/jwt';
import { hasPermission, Permission, getPermissionsForRole } from '../auth/roles';
import { UserRole, User, Hotel } from '../db/models';
import { runWithTenant } from '../db/tenantMiddleware';
import connectDB from '../db/connection';

// ========================================
// Auth Context Type
// ========================================

export interface AuthContext {
    userId: string;
    hotelId: string | null;
    role: UserRole;
    permissions: string[];
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function isSameOriginRequest(request: NextRequest): boolean {
    const origin = request.headers.get('origin');
    if (!origin) {
        return true;
    }

    const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
    if (!host) {
        return false;
    }

    const protocol =
        request.headers.get('x-forwarded-proto') ||
        request.nextUrl.protocol.replace(':', '');

    try {
        const originUrl = new URL(origin);
        return originUrl.protocol === `${protocol}:` && originUrl.host === host;
    } catch {
        return false;
    }
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
        if (MUTATING_METHODS.has(request.method.toUpperCase()) && !isSameOriginRequest(request)) {
            return NextResponse.json(
                { error: 'Forbidden request origin' },
                { status: 403 }
            );
        }

        const token = extractTokenFromRequest(request);

        if (!token) {
            return NextResponse.json(
                { error: 'Access token is required' },
                { status: 401 }
            );
        }

        const payload = await verifyAccessToken(token);

        if (!payload) {
            return NextResponse.json(
                { error: 'Invalid or expired access token' },
                { status: 401 }
            );
        }

        await connectDB();

        const user = await User.findById(payload.sub)
            .select('isActive role hotelId permissions')
            .lean();

        if (!user || !user.isActive) {
            return NextResponse.json(
                { error: 'User is inactive or not found' },
                { status: 401 }
            );
        }

        if (user.role !== 'super_admin' && user.hotelId) {
            const hotel = await Hotel.findById(user.hotelId).select('isActive').lean();
            if (!hotel?.isActive) {
                return NextResponse.json(
                    { error: 'Hotel is inactive' },
                    { status: 403 }
                );
            }
        }

        const role = user.role as UserRole;
        const rolePermissions = getPermissionsForRole(role);
        const effectivePermissions = Array.from(
            new Set([...(rolePermissions || []), ...((user.permissions as string[]) || [])])
        );

        const auth: AuthContext = {
            userId: payload.sub,
            hotelId: user.hotelId?.toString() || null,
            role,
            permissions: effectivePermissions,
        };

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
                { error: 'Forbidden - missing required permission' },
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
                { error: 'Forbidden - role is not allowed' },
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
                { error: 'Forbidden - hotel context is required' },
                { status: 403 }
            );
        }

        if (!/^[a-f\d]{24}$/i.test(effectiveHotelId)) {
            return NextResponse.json(
                { error: 'Invalid hotel ID format' },
                { status: 400 }
            );
        }

        return runWithTenant(effectiveHotelId, () =>
            handler(request, context, { ...auth, hotelId: effectiveHotelId })
        );
    });
}
