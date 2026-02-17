'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
    AlertTriangle,
    Building2,
    CheckCircle,
    Loader2,
    Pencil,
    Plus,
    RefreshCcw,
    Search,
    Sparkles,
    Trash2,
    UserCog,
    Users,
    XCircle,
} from 'lucide-react';
import { createUserSchema, CreateUserInput } from '@/lib/validations';
import { fetchWithRefresh } from '@/lib/fetchWithRefresh';

interface HotelOption {
    _id: string;
    name: string;
}

interface UserItem {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    role: string;
    hotelId: string | null;
    hotel?: { name?: string };
    createdBy?: { name?: string };
    isActive: boolean;
}

interface EditUserForm {
    userId: string;
    name: string;
    email: string;
    phone: string;
    isActive: boolean;
}

interface DeleteUserForm {
    userId: string;
    name: string;
    email: string;
    role: string;
}

interface DefaultAccountTemplate {
    key: string;
    name: string;
    email: string;
    password: string;
    role: CreateUserInput['role'];
    requiresHotel: boolean;
}

const roleLabels: Record<string, string> = {
    super_admin: 'سوبر أدمن رئيسي',
    sub_super_admin: 'صب سوبر أدمن',
    admin: 'مدير الفندق',
    manager: 'مدير تشغيلي',
    receptionist: 'موظف استقبال',
    housekeeping: 'إشراف نظافة',
    accountant: 'محاسب',
};

const allCreationRoles = ['sub_super_admin', 'admin', 'manager', 'receptionist', 'housekeeping', 'accountant'];
const subCreationRoles = ['admin', 'manager', 'receptionist', 'housekeeping', 'accountant'];

const DEFAULT_ACCOUNT_TEMPLATES: DefaultAccountTemplate[] = [
    {
        key: 'sub-super-admin',
        name: 'مشرف منصة افتراضي',
        email: 'subsuper.demo@hotel.local',
        password: 'Demo@12345',
        role: 'sub_super_admin',
        requiresHotel: false,
    },
    {
        key: 'hotel-admin',
        name: 'مدير فندق افتراضي',
        email: 'admin.demo@hotel.local',
        password: 'Demo@12345',
        role: 'admin',
        requiresHotel: true,
    },
    {
        key: 'hotel-manager',
        name: 'مدير تشغيلي افتراضي',
        email: 'manager.demo@hotel.local',
        password: 'Demo@12345',
        role: 'manager',
        requiresHotel: true,
    },
    {
        key: 'hotel-receptionist',
        name: 'موظف استقبال افتراضي',
        email: 'reception.demo@hotel.local',
        password: 'Demo@12345',
        role: 'receptionist',
        requiresHotel: true,
    },
    {
        key: 'hotel-housekeeping',
        name: 'مشرف نظافة افتراضي',
        email: 'housekeeping.demo@hotel.local',
        password: 'Demo@12345',
        role: 'housekeeping',
        requiresHotel: true,
    },
    {
        key: 'hotel-accountant',
        name: 'محاسب افتراضي',
        email: 'accountant.demo@hotel.local',
        password: 'Demo@12345',
        role: 'accountant',
        requiresHotel: true,
    },
];

export default function SuperAdminUsersPage() {
    const [currentRole, setCurrentRole] = useState<'super_admin' | 'sub_super_admin' | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    const [users, setUsers] = useState<UserItem[]>([]);
    const [hotels, setHotels] = useState<HotelOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [savingEdit, setSavingEdit] = useState(false);
    const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
    const [seedingDefaults, setSeedingDefaults] = useState(false);

    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [hotelFilter, setHotelFilter] = useState('');

    const [editForm, setEditForm] = useState<EditUserForm | null>(null);
    const [deleteForm, setDeleteForm] = useState<DeleteUserForm | null>(null);
    const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');

    const {
        register,
        handleSubmit,
        reset,
        watch,
        formState: { errors },
    } = useForm<CreateUserInput>({
        resolver: zodResolver(createUserSchema),
        defaultValues: { role: 'admin' },
    });

    const selectedRole = watch('role');
    const canDeleteUsers = currentRole === 'super_admin';

    const loadCurrentUser = async () => {
        try {
            const response = await fetchWithRefresh('/api/auth/me');
            if (!response.ok) return;
            const data = await response.json();
            if (data.user?.role === 'super_admin' || data.user?.role === 'sub_super_admin') {
                setCurrentRole(data.user.role);
                setCurrentUserId(data.user.id || null);
            }
        } catch {
            // layout handles auth redirection
        }
    };

    const fetchHotels = async () => {
        try {
            const response = await fetchWithRefresh('/api/super-admin/hotels?limit=200');
            const data = await response.json();
            if (!response.ok) {
                setError(data.error || 'تعذر تحميل الفنادق');
                return;
            }
            setHotels(Array.isArray(data.data) ? data.data : []);
        } catch {
            setError('تعذر تحميل الفنادق');
        }
    };

    const fetchUsers = async (params?: { search?: string; role?: string; hotelId?: string }) => {
        try {
            const query = new URLSearchParams({ limit: '200' });
            if (params?.search) query.set('search', params.search);
            if (params?.role) query.set('role', params.role);
            if (params?.hotelId) query.set('hotelId', params.hotelId);

            const response = await fetchWithRefresh(`/api/super-admin/users?${query}`);
            const data = await response.json();
            if (!response.ok) {
                setError(data.error || 'تعذر تحميل المستخدمين');
                return;
            }
            setUsers(Array.isArray(data.data) ? data.data : []);
        } catch {
            setError('تعذر تحميل المستخدمين');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCurrentUser();
        fetchHotels();
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            setSearch(searchInput.trim());
        }, 300);
        return () => clearTimeout(timer);
    }, [searchInput]);

    useEffect(() => {
        setLoading(true);
        fetchUsers({ search, role: roleFilter, hotelId: hotelFilter });
    }, [search, roleFilter, hotelFilter]);

    const createRoles = useMemo(() => {
        return currentRole === 'sub_super_admin' ? subCreationRoles : allCreationRoles;
    }, [currentRole]);

    const defaultTemplates = useMemo(() => {
        const allowedRoles = new Set(createRoles);
        return DEFAULT_ACCOUNT_TEMPLATES.filter((template) => allowedRoles.has(template.role));
    }, [createRoles]);

    const targetHotelIdForDefaults = useMemo(() => {
        if (hotelFilter) return hotelFilter;
        return hotels[0]?._id || '';
    }, [hotelFilter, hotels]);

    const targetHotelNameForDefaults = useMemo(() => {
        if (!targetHotelIdForDefaults) return '-';
        const match = hotels.find((hotel) => hotel._id === targetHotelIdForDefaults);
        return match?.name || '-';
    }, [hotels, targetHotelIdForDefaults]);

    const userStats = useMemo(() => {
        return {
            total: users.length,
            active: users.filter((item) => item.isActive).length,
            inactive: users.filter((item) => !item.isActive).length,
            platform: users.filter((item) => item.role === 'super_admin' || item.role === 'sub_super_admin').length,
        };
    }, [users]);

    const onSubmit = async (data: CreateUserInput) => {
        setError(null);
        setSuccess(null);
        setSubmitting(true);

        try {
            const isPlatformRole = data.role === 'super_admin' || data.role === 'sub_super_admin';
            const response = await fetchWithRefresh('/api/super-admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...data,
                    hotelId: isPlatformRole ? null : data.hotelId,
                }),
            });

            const result = await response.json();
            if (!response.ok) {
                setError(result.error || 'فشل إنشاء المستخدم');
                return;
            }

            setSuccess('تم إنشاء المستخدم بنجاح');
            await fetchUsers({ search, role: roleFilter, hotelId: hotelFilter });
            reset({ role: 'admin' });
        } catch {
            setError('فشل الاتصال بالخادم');
        } finally {
            setSubmitting(false);
        }
    };

    const toggleUserStatus = async (user: UserItem) => {
        setError(null);
        setSuccess(null);
        try {
            const response = await fetchWithRefresh(`/api/super-admin/users/${user._id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: !user.isActive }),
            });
            const result = await response.json();
            if (!response.ok) {
                setError(result.error || 'فشل تحديث حالة الحساب');
                return;
            }
            setUsers((prev) => prev.map((item) => (item._id === user._id ? { ...item, isActive: result.data.isActive } : item)));
            setSuccess('تم تحديث الحالة');
        } catch {
            setError('فشل الاتصال بالخادم');
        }
    };

    const openEditUser = (user: UserItem) => {
        setEditForm({
            userId: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone || '',
            isActive: user.isActive,
        });
    };

    const saveUserEdit = async () => {
        if (!editForm) return;
        setSavingEdit(true);
        setError(null);
        setSuccess(null);
        try {
            const response = await fetchWithRefresh(`/api/super-admin/users/${editForm.userId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: editForm.name,
                    email: editForm.email,
                    phone: editForm.phone.trim() || null,
                    isActive: editForm.isActive,
                }),
            });
            const result = await response.json();
            if (!response.ok) {
                setError(result.error || 'فشل تحديث المستخدم');
                return;
            }
            setSuccess('تم تحديث المستخدم');
            setEditForm(null);
            await fetchUsers({ search, role: roleFilter, hotelId: hotelFilter });
        } catch {
            setError('فشل الاتصال بالخادم');
        } finally {
            setSavingEdit(false);
        }
    };

    const openDeleteUser = (user: UserItem) => {
        setError(null);
        setSuccess(null);

        if (!canDeleteUsers) {
            setError('حذف الحسابات متاح للسوبر أدمن الرئيسي فقط');
            return;
        }

        if (user.role === 'super_admin') {
            setError('لا يمكن حذف حساب السوبر أدمن الرئيسي');
            return;
        }

        if (user._id === currentUserId) {
            setError('لا يمكنك حذف حسابك الحالي');
            return;
        }

        setDeleteForm({
            userId: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
        });
        setDeleteConfirmEmail('');
    };

    const closeDeleteUser = () => {
        if (deletingUserId) return;
        setDeleteForm(null);
        setDeleteConfirmEmail('');
    };

    const confirmDeleteUser = async () => {
        if (!deleteForm) return;
        setError(null);
        setSuccess(null);

        if (deleteConfirmEmail.trim().toLowerCase() !== deleteForm.email.toLowerCase()) {
            setError('يجب إدخال البريد الإلكتروني الصحيح لتأكيد الحذف');
            return;
        }

        setDeletingUserId(deleteForm.userId);
        try {
            const response = await fetchWithRefresh(`/api/super-admin/users/${deleteForm.userId}`, {
                method: 'DELETE',
            });
            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                setError((result as { error?: string }).error || 'فشل حذف الحساب');
                return;
            }

            setUsers((prev) => prev.filter((item) => item._id !== deleteForm.userId));
            if (editForm?.userId === deleteForm.userId) {
                setEditForm(null);
            }
            setSuccess(`تم حذف الحساب: ${deleteForm.name}`);
            setDeleteForm(null);
            setDeleteConfirmEmail('');
        } catch {
            setError('فشل الاتصال بالخادم');
        } finally {
            setDeletingUserId(null);
        }
    };

    const clearFilters = () => {
        setSearchInput('');
        setRoleFilter('');
        setHotelFilter('');
    };

    const seedDefaultAccounts = async () => {
        setError(null);
        setSuccess(null);

        if (defaultTemplates.length === 0) {
            setError('لا توجد قوالب افتراضية متاحة لهذا الحساب');
            return;
        }

        const needsHotel = defaultTemplates.some((item) => item.requiresHotel);
        if (needsHotel && !targetHotelIdForDefaults) {
            setError('أضف فندقًا واحدًا على الأقل أو اختر فندقًا من الفلاتر قبل إنشاء الحسابات الافتراضية');
            return;
        }

        setSeedingDefaults(true);

        let created = 0;
        let skipped = 0;
        const failed: string[] = [];

        try {
            for (const template of defaultTemplates) {
                const response = await fetchWithRefresh('/api/super-admin/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: template.name,
                        email: template.email,
                        password: template.password,
                        role: template.role,
                        hotelId: template.requiresHotel ? targetHotelIdForDefaults : null,
                    }),
                });

                const payload = await response.json().catch(() => ({} as { error?: string }));

                if (response.ok) {
                    created += 1;
                    continue;
                }

                if (response.status === 409) {
                    skipped += 1;
                    continue;
                }

                failed.push(`${template.email}: ${payload.error || 'فشل الإنشاء'}`);
            }

            await fetchUsers({ search, role: roleFilter, hotelId: hotelFilter });
            setSuccess(`نتيجة إنشاء البيانات الافتراضية: ${created} تم إنشاؤها، ${skipped} موجودة مسبقًا`);

            if (failed.length > 0) {
                setError(`فشل إنشاء بعض الحسابات: ${failed.slice(0, 2).join(' | ')}`);
            }
        } catch {
            setError('فشل إنشاء الحسابات الافتراضية');
        } finally {
            setSeedingDefaults(false);
        }
    };

    const hotelOptions = useMemo(() => hotels.map((hotel) => ({ value: hotel._id, label: hotel.name })), [hotels]);
    const selectedRoleIsPlatform = selectedRole === 'super_admin' || selectedRole === 'sub_super_admin';

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">إدارة المستخدمين والصلاحيات</h1>
                <p className="mt-1 text-white/60">إدارة حسابات المنصة والفنادق وفق نطاق الصلاحيات المعتمد، مع حذف آمن للحسابات.</p>
            </div>

            {(error || success) && (
                <div className="space-y-2">
                    {error && <div className="p-3 bg-danger-500/10 border border-danger-500/20 rounded-xl text-danger-600 text-sm">{error}</div>}
                    {success && <div className="p-3 bg-success-500/10 border border-success-500/20 rounded-xl text-success-500 text-sm">{success}</div>}
                </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="stat-card">
                    <p className="text-xs text-white/50">إجمالي الحسابات</p>
                    <p className="text-lg font-semibold text-primary-300">{userStats.total}</p>
                </div>
                <div className="stat-card">
                    <p className="text-xs text-white/50">حسابات نشطة</p>
                    <p className="text-lg font-semibold text-success-500">{userStats.active}</p>
                </div>
                <div className="stat-card">
                    <p className="text-xs text-white/50">حسابات غير نشطة</p>
                    <p className="text-lg font-semibold text-danger-500">{userStats.inactive}</p>
                </div>
                <div className="stat-card">
                    <p className="text-xs text-white/50">حسابات المنصة</p>
                    <p className="text-lg font-semibold text-accent-300">{userStats.platform}</p>
                </div>
            </div>

            <div className="card p-5 space-y-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <UserCog className="w-5 h-5 text-primary-300" />
                    إنشاء مستخدم
                </h2>

                <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input {...register('name')} className="input-compact w-full" placeholder="الاسم" />
                    <input {...register('email')} type="email" className="input-compact w-full" placeholder="البريد الإلكتروني" dir="ltr" />
                    <input {...register('password')} type="password" className="input-compact w-full" placeholder="كلمة المرور" dir="ltr" />
                    <select {...register('role')} className="input-compact w-full">
                        {createRoles.map((value) => (
                            <option key={value} value={value}>{roleLabels[value] || value}</option>
                        ))}
                    </select>
                    <div className="md:col-span-2 relative">
                        <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                        <select {...register('hotelId')} className="input-compact w-full pr-9" disabled={selectedRoleIsPlatform}>
                            <option value="">اختر الفندق</option>
                            {hotelOptions.map((hotel) => (
                                <option key={hotel.value} value={hotel.value}>{hotel.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="md:col-span-2 flex justify-end">
                        <button type="submit" className="btn-primary text-sm" disabled={submitting}>
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" />إنشاء المستخدم</>}
                        </button>
                    </div>
                </form>

                {(errors.name || errors.email || errors.password || errors.role || errors.hotelId) && (
                    <p className="text-xs text-danger-500">يرجى مراجعة الحقول قبل الإرسال.</p>
                )}
            </div>

            <div className="card p-5 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-accent-300" />
                            بيانات افتراضية للحسابات
                        </h2>
                        <p className="text-xs text-white/60 mt-1">
                            إنشاء حسابات جاهزة للتجربة بسرعة. كلمة المرور الافتراضية لكل الحسابات: <span dir="ltr" className="font-mono">Demo@12345</span>
                        </p>
                        <p className="text-xs text-white/50 mt-1">
                            الفندق المستهدف للحسابات التشغيلية: <span className="text-white">{targetHotelNameForDefaults}</span>
                        </p>
                    </div>
                    <button type="button" className="btn-secondary text-sm" onClick={seedDefaultAccounts} disabled={seedingDefaults}>
                        {seedingDefaults ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" />إضافة الحسابات الافتراضية</>}
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                    {defaultTemplates.map((template) => (
                        <div key={template.key} className="surface-tile space-y-1">
                            <p className="text-sm text-white font-medium">{template.name}</p>
                            <p className="text-xs text-white/60">{roleLabels[template.role] || template.role}</p>
                            <p className="text-xs text-white/60" dir="ltr">{template.email}</p>
                            <p className="text-[11px] text-white/45">
                                {template.requiresHotel ? `الفندق: ${targetHotelNameForDefaults}` : 'حساب منصة'}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="card p-5 space-y-4">
                <div className="flex flex-col lg:flex-row gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="input-compact w-full pr-9"
                            placeholder="بحث بالاسم أو البريد الإلكتروني"
                        />
                    </div>
                    <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className="input-compact min-w-[180px]"
                    >
                        <option value="">كل الأدوار</option>
                        {Object.entries(roleLabels).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                        ))}
                    </select>
                    <select
                        value={hotelFilter}
                        onChange={(e) => setHotelFilter(e.target.value)}
                        className="input-compact min-w-[180px]"
                    >
                        <option value="">كل الفنادق</option>
                        {hotelOptions.map((hotel) => (
                            <option key={hotel.value} value={hotel.value}>{hotel.label}</option>
                        ))}
                    </select>
                    <button type="button" onClick={clearFilters} className="btn-secondary text-sm">
                        مسح الفلاتر
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setLoading(true);
                            fetchUsers({ search, role: roleFilter, hotelId: hotelFilter });
                        }}
                        className="btn-secondary text-sm"
                    >
                        <RefreshCcw className="w-4 h-4" />
                        تحديث
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center py-8"><div className="spinner w-10 h-10" /></div>
                ) : users.length === 0 ? (
                    <p className="text-white/60 text-center py-8">لا يوجد مستخدمون حاليًا.</p>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>الاسم</th>
                                    <th>البريد</th>
                                    <th>الدور</th>
                                    <th>الفندق</th>
                                    <th>تم الإنشاء بواسطة</th>
                                    <th>الحالة</th>
                                    <th>إجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((user) => {
                                    const isSelf = user._id === currentUserId;
                                    const isMainSuper = user.role === 'super_admin';
                                    const deleteDisabled = !canDeleteUsers || isSelf || isMainSuper || Boolean(deletingUserId);

                                    return (
                                        <tr key={user._id}>
                                            <td className="font-medium text-white">
                                                <div className="flex items-center gap-2">
                                                    <span>{user.name}</span>
                                                    {isSelf && <span className="badge-primary text-[10px]">حسابك</span>}
                                                </div>
                                            </td>
                                            <td className="text-white/60" dir="ltr">{user.email}</td>
                                            <td className="text-white/70">{roleLabels[user.role] || user.role}</td>
                                            <td className="text-white/60">{user.hotel?.name || '-'}</td>
                                            <td className="text-white/60">{user.createdBy?.name || '-'}</td>
                                            <td>
                                                {user.isActive ? (
                                                    <span className="badge-success inline-flex items-center gap-1"><CheckCircle className="w-3 h-3" />نشط</span>
                                                ) : (
                                                    <span className="badge-danger inline-flex items-center gap-1"><XCircle className="w-3 h-3" />غير نشط</span>
                                                )}
                                            </td>
                                            <td>
                                                <div className="flex flex-wrap gap-1">
                                                    <button onClick={() => toggleUserStatus(user)} className="btn-secondary text-xs" disabled={isSelf && user.isActive}>
                                                        {user.isActive ? 'تعطيل' : 'تفعيل'}
                                                    </button>
                                                    <button onClick={() => openEditUser(user)} className="btn-secondary text-xs">
                                                        <Pencil className="w-3.5 h-3.5" />
                                                        تعديل
                                                    </button>
                                                    {canDeleteUsers && (
                                                        <button
                                                            onClick={() => openDeleteUser(user)}
                                                            className="btn-danger text-xs"
                                                            disabled={deleteDisabled}
                                                            title={isSelf ? 'لا يمكنك حذف حسابك' : isMainSuper ? 'لا يمكن حذف السوبر أدمن الرئيسي' : 'حذف الحساب'}
                                                        >
                                                            {deletingUserId === user._id ? (
                                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                            ) : (
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            )}
                                                            حذف
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {editForm && (
                <div className="card p-5 space-y-3">
                    <h3 className="text-base font-semibold text-white">تعديل حساب المستخدم</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input value={editForm.name} onChange={(e) => setEditForm((prev) => prev ? { ...prev, name: e.target.value } : prev)} className="input-compact w-full" placeholder="الاسم" />
                        <input value={editForm.email} onChange={(e) => setEditForm((prev) => prev ? { ...prev, email: e.target.value } : prev)} className="input-compact w-full" placeholder="البريد الإلكتروني" dir="ltr" />
                        <input value={editForm.phone} onChange={(e) => setEditForm((prev) => prev ? { ...prev, phone: e.target.value } : prev)} className="input-compact w-full" placeholder="رقم الهاتف" dir="ltr" />
                        <label className="surface-tile flex items-center justify-between text-sm">
                            تفعيل الحساب
                            <input type="checkbox" checked={editForm.isActive} onChange={(e) => setEditForm((prev) => prev ? { ...prev, isActive: e.target.checked } : prev)} />
                        </label>
                    </div>
                    <div className="flex justify-end gap-2">
                        <button className="btn-secondary text-sm" onClick={() => setEditForm(null)}>إغلاق</button>
                        <button className="btn-primary text-sm" onClick={saveUserEdit} disabled={savingEdit}>
                            {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : 'حفظ التعديلات'}
                        </button>
                    </div>
                </div>
            )}

            {deleteForm && (
                <div className="card p-5 space-y-4 border border-danger-500/30">
                    <h3 className="text-base font-semibold text-white flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-danger-500" />
                        تأكيد حذف الحساب
                    </h3>
                    <p className="text-sm text-white/70">
                        سيتم حذف الحساب <span className="text-white font-medium">{deleteForm.name}</span> نهائيًا.
                        اكتب البريد الإلكتروني لتأكيد العملية:
                    </p>
                    <div className="surface-tile">
                        <p className="text-xs text-white/50 mb-1">البريد المطلوب للتأكيد</p>
                        <p className="text-sm text-white font-medium" dir="ltr">{deleteForm.email}</p>
                    </div>
                    <input
                        value={deleteConfirmEmail}
                        onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                        className="input-compact w-full"
                        placeholder="أدخل البريد الإلكتروني للتأكيد"
                        dir="ltr"
                    />
                    <div className="flex justify-end gap-2">
                        <button className="btn-secondary text-sm" onClick={closeDeleteUser} disabled={Boolean(deletingUserId)}>
                            إلغاء
                        </button>
                        <button className="btn-danger text-sm" onClick={confirmDeleteUser} disabled={Boolean(deletingUserId)}>
                            {deletingUserId ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Trash2 className="w-4 h-4" />تأكيد الحذف</>}
                        </button>
                    </div>
                </div>
            )}

            {!canDeleteUsers && (
                <div className="surface-tile text-xs text-white/60 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    حذف الحسابات متاح فقط للسوبر أدمن الرئيسي.
                </div>
            )}
        </div>
    );
}
