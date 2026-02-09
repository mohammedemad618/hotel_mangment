'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Search, Loader2, CheckCircle, XCircle, UserCog, Building2, Pencil } from 'lucide-react';
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

export default function SuperAdminUsersPage() {
    const [currentRole, setCurrentRole] = useState<'super_admin' | 'sub_super_admin' | null>(null);
    const [users, setUsers] = useState<UserItem[]>([]);
    const [hotels, setHotels] = useState<HotelOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [savingEdit, setSavingEdit] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [hotelFilter, setHotelFilter] = useState('');
    const [editForm, setEditForm] = useState<EditUserForm | null>(null);

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

    const loadCurrentUser = async () => {
        try {
            const response = await fetchWithRefresh('/api/auth/me');
            if (!response.ok) return;
            const data = await response.json();
            if (data.user?.role === 'super_admin' || data.user?.role === 'sub_super_admin') {
                setCurrentRole(data.user.role);
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
        fetchUsers();
    }, []);

    const createRoles = useMemo(() => {
        // Show the full list by default; restrict only when we are sure
        // the signed-in account is sub_super_admin.
        return currentRole === 'sub_super_admin' ? subCreationRoles : allCreationRoles;
    }, [currentRole]);

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

    const handleFilterChange = async (nextSearch: string, nextRole: string, nextHotel: string) => {
        setLoading(true);
        await fetchUsers({ search: nextSearch, role: nextRole, hotelId: nextHotel });
    };

    const hotelOptions = useMemo(() => hotels.map((hotel) => ({ value: hotel._id, label: hotel.name })), [hotels]);

    const selectedRoleIsPlatform = selectedRole === 'super_admin' || selectedRole === 'sub_super_admin';

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">إدارة المستخدمين والصلاحيات</h1>
                <p className="mt-1 text-white/60">إدارة حسابات المنصة والفنادق وفق نطاق الصلاحيات المعتمد.</p>
            </div>

            {(error || success) && (
                <div className="space-y-2">
                    {error && <div className="p-3 bg-danger-500/10 border border-danger-500/20 rounded-xl text-danger-600 text-sm">{error}</div>}
                    {success && <div className="p-3 bg-success-500/10 border border-success-500/20 rounded-xl text-success-500 text-sm">{success}</div>}
                </div>
            )}

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
                <div className="flex flex-col lg:flex-row gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                handleFilterChange(e.target.value, roleFilter, hotelFilter);
                            }}
                            className="input-compact w-full pr-9"
                            placeholder="بحث بالاسم أو البريد الإلكتروني"
                        />
                    </div>
                    <select
                        value={roleFilter}
                        onChange={(e) => {
                            setRoleFilter(e.target.value);
                            handleFilterChange(search, e.target.value, hotelFilter);
                        }}
                        className="input-compact min-w-[180px]"
                    >
                        <option value="">كل الأدوار</option>
                        {Object.entries(roleLabels).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                        ))}
                    </select>
                    <select
                        value={hotelFilter}
                        onChange={(e) => {
                            setHotelFilter(e.target.value);
                            handleFilterChange(search, roleFilter, e.target.value);
                        }}
                        className="input-compact min-w-[180px]"
                    >
                        <option value="">كل الفنادق</option>
                        {hotelOptions.map((hotel) => (
                            <option key={hotel.value} value={hotel.value}>{hotel.label}</option>
                        ))}
                    </select>
                </div>

                {loading ? (
                    <div className="flex justify-center py-8"><div className="spinner w-10 h-10" /></div>
                ) : users.length === 0 ? (
                    <p className="text-white/60 text-center py-8">لا يوجد مستخدمون حالياً.</p>
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
                                {users.map((user) => (
                                    <tr key={user._id}>
                                        <td className="font-medium text-white">{user.name}</td>
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
                                                <button onClick={() => toggleUserStatus(user)} className="btn-secondary text-xs">{user.isActive ? 'تعطيل' : 'تفعيل'}</button>
                                                <button onClick={() => openEditUser(user)} className="btn-secondary text-xs"><Pencil className="w-3.5 h-3.5" />تعديل</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
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
                        <label className="surface-tile flex items-center justify-between text-sm">تفعيل الحساب<input type="checkbox" checked={editForm.isActive} onChange={(e) => setEditForm((prev) => prev ? { ...prev, isActive: e.target.checked } : prev)} /></label>
                    </div>
                    <div className="flex justify-end gap-2">
                        <button className="btn-secondary text-sm" onClick={() => setEditForm(null)}>إغلاق</button>
                        <button className="btn-primary text-sm" onClick={saveUserEdit} disabled={savingEdit}>{savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : 'حفظ التعديلات'}</button>
                    </div>
                </div>
            )}
        </div>
    );
}
