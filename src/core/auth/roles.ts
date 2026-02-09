import { UserRole } from '../db/models';

// ========================================
// Permissions Definition
// ========================================

export const PERMISSIONS = {
    // Hotel Management
    HOTEL_CREATE: 'hotel:create',
    HOTEL_READ: 'hotel:read',
    HOTEL_UPDATE: 'hotel:update',
    HOTEL_DELETE: 'hotel:delete',

    // User Management
    USER_CREATE: 'user:create',
    USER_READ: 'user:read',
    USER_UPDATE: 'user:update',
    USER_DELETE: 'user:delete',

    // Room Management
    ROOM_CREATE: 'room:create',
    ROOM_READ: 'room:read',
    ROOM_UPDATE: 'room:update',
    ROOM_DELETE: 'room:delete',

    // Booking Management
    BOOKING_CREATE: 'booking:create',
    BOOKING_READ: 'booking:read',
    BOOKING_UPDATE: 'booking:update',
    BOOKING_DELETE: 'booking:delete',
    BOOKING_CONFIRM: 'booking:confirm',
    BOOKING_CANCEL: 'booking:cancel',
    BOOKING_CHECKIN: 'booking:checkin',
    BOOKING_CHECKOUT: 'booking:checkout',

    // Guest Management
    GUEST_CREATE: 'guest:create',
    GUEST_READ: 'guest:read',
    GUEST_UPDATE: 'guest:update',
    GUEST_DELETE: 'guest:delete',

    // Financial
    PAYMENT_CREATE: 'payment:create',
    PAYMENT_READ: 'payment:read',
    PAYMENT_REFUND: 'payment:refund',
    REPORT_VIEW: 'report:view',
    REPORT_EXPORT: 'report:export',

    // Settings
    SETTINGS_READ: 'settings:read',
    SETTINGS_UPDATE: 'settings:update',

    // Housekeeping
    HOUSEKEEPING_READ: 'housekeeping:read',
    HOUSEKEEPING_UPDATE: 'housekeeping:update',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// ========================================
// Role Permissions Mapping
// ========================================

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
    super_admin: Object.values(PERMISSIONS),
    sub_super_admin: [
        PERMISSIONS.HOTEL_CREATE,
        PERMISSIONS.HOTEL_READ,
        PERMISSIONS.HOTEL_UPDATE,
        PERMISSIONS.USER_CREATE,
        PERMISSIONS.USER_READ,
        PERMISSIONS.USER_UPDATE,
        PERMISSIONS.REPORT_VIEW,
        PERMISSIONS.REPORT_EXPORT,
    ],

    admin: [
        PERMISSIONS.HOTEL_READ,
        PERMISSIONS.HOTEL_UPDATE,
        PERMISSIONS.USER_CREATE,
        PERMISSIONS.USER_READ,
        PERMISSIONS.USER_UPDATE,
        PERMISSIONS.USER_DELETE,
        PERMISSIONS.ROOM_CREATE,
        PERMISSIONS.ROOM_READ,
        PERMISSIONS.ROOM_UPDATE,
        PERMISSIONS.ROOM_DELETE,
        PERMISSIONS.BOOKING_CREATE,
        PERMISSIONS.BOOKING_READ,
        PERMISSIONS.BOOKING_UPDATE,
        PERMISSIONS.BOOKING_DELETE,
        PERMISSIONS.BOOKING_CONFIRM,
        PERMISSIONS.BOOKING_CANCEL,
        PERMISSIONS.BOOKING_CHECKIN,
        PERMISSIONS.BOOKING_CHECKOUT,
        PERMISSIONS.GUEST_CREATE,
        PERMISSIONS.GUEST_READ,
        PERMISSIONS.GUEST_UPDATE,
        PERMISSIONS.GUEST_DELETE,
        PERMISSIONS.PAYMENT_CREATE,
        PERMISSIONS.PAYMENT_READ,
        PERMISSIONS.PAYMENT_REFUND,
        PERMISSIONS.REPORT_VIEW,
        PERMISSIONS.REPORT_EXPORT,
        PERMISSIONS.SETTINGS_READ,
        PERMISSIONS.SETTINGS_UPDATE,
        PERMISSIONS.HOUSEKEEPING_READ,
        PERMISSIONS.HOUSEKEEPING_UPDATE,
    ],

    manager: [
        PERMISSIONS.HOTEL_READ,
        PERMISSIONS.USER_READ,
        PERMISSIONS.ROOM_CREATE,
        PERMISSIONS.ROOM_READ,
        PERMISSIONS.ROOM_UPDATE,
        PERMISSIONS.BOOKING_CREATE,
        PERMISSIONS.BOOKING_READ,
        PERMISSIONS.BOOKING_UPDATE,
        PERMISSIONS.BOOKING_CONFIRM,
        PERMISSIONS.BOOKING_CANCEL,
        PERMISSIONS.BOOKING_CHECKIN,
        PERMISSIONS.BOOKING_CHECKOUT,
        PERMISSIONS.GUEST_CREATE,
        PERMISSIONS.GUEST_READ,
        PERMISSIONS.GUEST_UPDATE,
        PERMISSIONS.PAYMENT_CREATE,
        PERMISSIONS.PAYMENT_READ,
        PERMISSIONS.REPORT_VIEW,
        PERMISSIONS.SETTINGS_READ,
        PERMISSIONS.HOUSEKEEPING_READ,
        PERMISSIONS.HOUSEKEEPING_UPDATE,
    ],

    receptionist: [
        PERMISSIONS.ROOM_READ,
        PERMISSIONS.BOOKING_CREATE,
        PERMISSIONS.BOOKING_READ,
        PERMISSIONS.BOOKING_UPDATE,
        PERMISSIONS.BOOKING_CONFIRM,
        PERMISSIONS.BOOKING_CANCEL,
        PERMISSIONS.BOOKING_CHECKIN,
        PERMISSIONS.BOOKING_CHECKOUT,
        PERMISSIONS.GUEST_CREATE,
        PERMISSIONS.GUEST_READ,
        PERMISSIONS.GUEST_UPDATE,
        PERMISSIONS.PAYMENT_CREATE,
        PERMISSIONS.PAYMENT_READ,
        PERMISSIONS.HOUSEKEEPING_READ,
    ],

    housekeeping: [
        PERMISSIONS.ROOM_READ,
        PERMISSIONS.HOUSEKEEPING_READ,
        PERMISSIONS.HOUSEKEEPING_UPDATE,
    ],

    accountant: [
        PERMISSIONS.BOOKING_READ,
        PERMISSIONS.GUEST_READ,
        PERMISSIONS.PAYMENT_CREATE,
        PERMISSIONS.PAYMENT_READ,
        PERMISSIONS.PAYMENT_REFUND,
        PERMISSIONS.REPORT_VIEW,
        PERMISSIONS.REPORT_EXPORT,
    ],
};

// ========================================
// Permission Checking Utilities
// ========================================

export function hasPermission(
    userRole: UserRole,
    userPermissions: string[],
    requiredPermission: Permission
): boolean {
    // Check role permissions first
    const rolePermissions = ROLE_PERMISSIONS[userRole] || [];
    if (rolePermissions.includes(requiredPermission)) {
        return true;
    }

    // Check custom permissions
    return userPermissions.includes(requiredPermission);
}

export function hasAnyPermission(
    userRole: UserRole,
    userPermissions: string[],
    requiredPermissions: Permission[]
): boolean {
    return requiredPermissions.some((perm) =>
        hasPermission(userRole, userPermissions, perm)
    );
}

export function hasAllPermissions(
    userRole: UserRole,
    userPermissions: string[],
    requiredPermissions: Permission[]
): boolean {
    return requiredPermissions.every((perm) =>
        hasPermission(userRole, userPermissions, perm)
    );
}

export function getPermissionsForRole(role: UserRole): Permission[] {
    return ROLE_PERMISSIONS[role] || [];
}

// ========================================
// Role Hierarchy
// ========================================

const ROLE_HIERARCHY: Record<UserRole, number> = {
    super_admin: 100,
    sub_super_admin: 90,
    admin: 80,
    manager: 60,
    accountant: 40,
    receptionist: 40,
    housekeeping: 20,
};

export function isRoleHigherOrEqual(role1: UserRole, role2: UserRole): boolean {
    return ROLE_HIERARCHY[role1] >= ROLE_HIERARCHY[role2];
}

export function canManageRole(managerRole: UserRole, targetRole: UserRole): boolean {
    // Can only manage roles lower than own
    return ROLE_HIERARCHY[managerRole] > ROLE_HIERARCHY[targetRole];
}
