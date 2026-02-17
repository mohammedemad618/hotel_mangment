import { PERMISSIONS, canManageRole, getPermissionsForRole, hasPermission } from './roles';

describe('RBAC roles', () => {
    it('grants super admin full permissions', () => {
        const permissions = getPermissionsForRole('super_admin');
        expect(permissions).toContain(PERMISSIONS.USER_DELETE);
        expect(permissions).toContain(PERMISSIONS.HOTEL_DELETE);
    });

    it('does not allow sub super admin to manage super admin role', () => {
        expect(canManageRole('sub_super_admin', 'super_admin')).toBe(false);
        expect(canManageRole('super_admin', 'sub_super_admin')).toBe(true);
    });

    it('checks role permissions before custom permissions', () => {
        expect(hasPermission('manager', [], PERMISSIONS.BOOKING_CREATE)).toBe(true);
        expect(hasPermission('manager', [], PERMISSIONS.USER_DELETE)).toBe(false);
        expect(hasPermission('manager', [PERMISSIONS.USER_DELETE], PERMISSIONS.USER_DELETE)).toBe(true);
    });
});
