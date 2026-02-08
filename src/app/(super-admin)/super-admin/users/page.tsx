'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
    Plus,
    Search,
    Loader2,
    CheckCircle,
    XCircle,
    UserCog,
    Building2,
} from 'lucide-react';
import { createUserSchema, CreateUserInput } from '@/lib/validations';

interface HotelOption {
    _id: string;
    name: string;
}

interface UserItem {
    _id: string;
    name: string;
    email: string;
    role: string;
    hotelId: string | null;
    hotel?: { name?: string };
    isActive: boolean;
}

const roleLabels: Record<string, string> = {
    super_admin: 'سوبر أدمن',
    admin: 'مدير',
    manager: 'مشرف',
    receptionist: 'استقبال',
    housekeeping: 'تنظيف',
    accountant: 'محاسب',
};

export default function SuperAdminUsersPage() {
    const [users, setUsers] = useState<UserItem[]>([]);
    const [hotels, setHotels] = useState<HotelOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [hotelFilter, setHotelFilter] = useState('');

    const refreshSession = async () => {
        const response = await fetch('/api/auth/refresh', { method: 'POST' });
        return response.ok;
    };

    const fetchWithRefresh = async (input: RequestInfo, init?: RequestInit) => {
        const response = await fetch(input, init);
        if (response.status !== 401) {
            return response;
        }

        const refreshed = await refreshSession();
        if (!refreshed) {
            return response;
        }

        return fetch(input, init);
    };

    const {
        register,
        handleSubmit,
        reset,
        watch,
        formState: { errors },
    } = useForm<CreateUserInput>({
        resolver: zodResolver(createUserSchema),
        defaultValues: {
            role: 'admin',
        },
    });

    const selectedRole = watch('role');

    const fetchHotels = async () => {
        try {
            const response = await fetchWithRefresh('/api/super-admin/hotels?limit=200');
            const data = await response.json();
            if (data.success) {
                setHotels(data.data);
            }
        } catch (err) {
            setError('تعذر تحميل قائمة الفنادق');
        }
    };

    const fetchUsers = async (params?: { search?: string; role?: string; hotelId?: string }) => {
        try {
            const query = new URLSearchParams();
            query.set('limit', '200');
            if (params?.search) query.set('search', params.search);
            if (params?.role) query.set('role', params.role);
            if (params?.hotelId) query.set('hotelId', params.hotelId);

            const response = await fetchWithRefresh(`/api/super-admin/users?${query}`);
            const data = await response.json();

            if (data.success) {
                setUsers(data.data);
            }
        } catch (err) {
            setError('تعذر تحميل المستخدمين');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHotels();
        fetchUsers();
    }, []);

    const onSubmit = async (data: CreateUserInput) => {
        setError(null);
        setSubmitting(true);

        try {
            const response = await fetchWithRefresh('/api/super-admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...data,
                    hotelId: data.role === 'super_admin' ? null : data.hotelId,
                }),
            });

            const result = await response.json();
            if (!response.ok) {
                setError(result.error || 'حدث خطأ أثناء إنشاء المستخدم');
                return;
            }

            await fetchUsers({ search, role: roleFilter, hotelId: hotelFilter });
            reset({ role: 'admin' });
        } catch (err) {
            setError('حدث خطأ في الاتصال بالخادم');
        } finally {
            setSubmitting(false);
        }
    };

    const toggleUserStatus = async (userId: string, isActive: boolean) => {
        try {
            const response = await fetchWithRefresh(`/api/super-admin/users/${userId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: !isActive }),
            });

            const result = await response.json();
            if (!response.ok) {
                setError(result.error || 'تعذر تحديث حالة المستخدم');
                return;
            }

            setUsers((prev) =>
                prev.map((user) =>
                    user._id === userId ? { ...user, isActive: result.data.isActive } : user
                )
            );
        } catch (err) {
            setError('حدث خطأ في الاتصال بالخادم');
        }
    };

    const handleFilterChange = async (nextSearch: string, nextRole: string, nextHotel: string) => {
        setLoading(true);
        await fetchUsers({
            search: nextSearch,
            role: nextRole,
            hotelId: nextHotel,
        });
    };

    const hotelOptions = useMemo(
        () => hotels.map((hotel) => ({ value: hotel._id, label: hotel.name })),
        [hotels]
    );

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">
                    إدارة المستخدمين
                </h1>
                <p className="mt-1 text-white/60">
                    إنشاء المستخدمين وربطهم بالفنادق والأدوار
                </p>
            </div>

            {error && (
                <div className="p-4 bg-danger-500/10 border border-danger-500/20 rounded-xl text-danger-600 text-sm">
                    {error}
                </div>
            )}

            <div className="card p-6 space-y-6">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <UserCog className="w-5 h-5 text-primary-300" />
                    إضافة مستخدم جديد
                </h2>

                <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <input
                            {...register('name')}
                            className="input"
                            placeholder="اسم المستخدم"
                        />
                        {errors.name && (
                            <p className="mt-1 text-sm text-danger-500">{errors.name.message}</p>
                        )}
                    </div>
                    <div>
                        <input
                            {...register('email')}
                            type="email"
                            className="input"
                            placeholder="البريد الإلكتروني"
                            dir="ltr"
                        />
                        {errors.email && (
                            <p className="mt-1 text-sm text-danger-500">{errors.email.message}</p>
                        )}
                    </div>
                    <div>
                        <input
                            {...register('password')}
                            type="password"
                            className="input"
                            placeholder="كلمة المرور"
                            dir="ltr"
                        />
                        {errors.password && (
                            <p className="mt-1 text-sm text-danger-500">{errors.password.message}</p>
                        )}
                    </div>
                    <div>
                        <select {...register('role')} className="input">
                            {Object.entries(roleLabels).map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </select>
                        {errors.role && (
                            <p className="mt-1 text-sm text-danger-500">{errors.role.message}</p>
                        )}
                    </div>
                    <div className="md:col-span-2">
                        <div className="relative">
                            <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                            <select
                                {...register('hotelId')}
                                className="input pr-10"
                                disabled={selectedRole === 'super_admin'}
                            >
                                <option value="">اختر الفندق</option>
                                {hotelOptions.map((hotel) => (
                                    <option key={hotel.value} value={hotel.value}>
                                        {hotel.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        {errors.hotelId && (
                            <p className="mt-1 text-sm text-danger-500">{errors.hotelId.message}</p>
                        )}
                    </div>
                    <div className="md:col-span-2 flex justify-end">
                        <button type="submit" className="btn-primary" disabled={submitting}>
                            {submitting ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <Plus className="w-5 h-5" />
                                    <span>إضافة المستخدم</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>

            <div className="card p-6 space-y-4">
                <div className="flex flex-col lg:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                handleFilterChange(e.target.value, roleFilter, hotelFilter);
                            }}
                            className="input pr-10"
                            placeholder="ابحث بالاسم أو البريد..."
                        />
                    </div>
                    <select
                        value={roleFilter}
                        onChange={(e) => {
                            setRoleFilter(e.target.value);
                            handleFilterChange(search, e.target.value, hotelFilter);
                        }}
                        className="input min-w-[180px]"
                    >
                        <option value="">كل الأدوار</option>
                        {Object.entries(roleLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                    <select
                        value={hotelFilter}
                        onChange={(e) => {
                            setHotelFilter(e.target.value);
                            handleFilterChange(search, roleFilter, e.target.value);
                        }}
                        className="input min-w-[180px]"
                    >
                        <option value="">كل الفنادق</option>
                        {hotelOptions.map((hotel) => (
                            <option key={hotel.value} value={hotel.value}>
                                {hotel.label}
                            </option>
                        ))}
                    </select>
                </div>

                {loading ? (
                    <div className="flex justify-center py-8">
                        <div className="spinner w-10 h-10" />
                    </div>
                ) : users.length === 0 ? (
                    <p className="text-white/60 text-center py-8">
                        لا يوجد مستخدمون حالياً
                    </p>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>الاسم</th>
                                    <th>البريد</th>
                                    <th>الدور</th>
                                    <th>الفندق</th>
                                    <th>الحالة</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((user) => (
                                    <tr key={user._id}>
                                        <td className="font-medium text-white">
                                            {user.name}
                                        </td>
                                        <td className="text-white/60">
                                            {user.email}
                                        </td>
                                        <td className="text-white/60">
                                            {roleLabels[user.role] || user.role}
                                        </td>
                                        <td className="text-white/60">
                                            {user.role === 'super_admin' ? '—' : user.hotel?.name || '—'}
                                        </td>
                                        <td>
                                            {user.isActive ? (
                                                <span className="badge-success inline-flex items-center gap-1">
                                                    <CheckCircle className="w-3 h-3" />
                                                    نشط
                                                </span>
                                            ) : (
                                                <span className="badge-danger inline-flex items-center gap-1">
                                                    <XCircle className="w-3 h-3" />
                                                    غير نشط
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            <button
                                                onClick={() => toggleUserStatus(user._id, user.isActive)}
                                                className="btn-secondary text-xs"
                                            >
                                                {user.isActive ? 'تعطيل' : 'تفعيل'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
