'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
    Building2,
    Plus,
    Search,
    Loader2,
    CheckCircle,
    XCircle,
    Users,
    RefreshCcw,
    ArrowUpDown,
} from 'lucide-react';
import { registerHotelSchema, RegisterHotelInput } from '@/lib/validations';
import { fetchWithRefresh } from '@/lib/fetchWithRefresh';

interface HotelItem {
    _id: string;
    name: string;
    email: string;
    phone: string;
    slug: string;
    address?: { city?: string; country?: string };
    subscription?: { plan?: string; status?: string };
    isActive: boolean;
    createdAt: string;
}

export default function SuperAdminPage() {
    const [hotels, setHotels] = useState<HotelItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [planFilter, setPlanFilter] = useState<'all' | 'free' | 'basic' | 'premium' | 'enterprise'>('all');
    const [sortBy, setSortBy] = useState<'createdAt' | 'name'>('createdAt');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<RegisterHotelInput>({
        resolver: zodResolver(registerHotelSchema),
    });

    const fetchHotels = async (searchValue = '') => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (searchValue) params.set('search', searchValue);
            params.set('limit', '100');

            const response = await fetchWithRefresh(`/api/super-admin/hotels?${params}`);
            const data = await response.json();

            if (data.success) {
                setHotels(data.data);
            }
        } catch (err) {
            setError('تعذر جلب قائمة الفنادق');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHotels();
    }, []);

    useEffect(() => {
        const trimmed = searchInput.trim();
        if (trimmed === search) {
            return;
        }
        const timer = setTimeout(() => {
            setSearch(trimmed);
        }, 350);
        return () => clearTimeout(timer);
    }, [searchInput, search]);

    useEffect(() => {
        fetchHotels(search);
    }, [search]);

    const onSubmit = async (data: RegisterHotelInput) => {
        setError(null);
        setSubmitting(true);

        try {
            const response = await fetchWithRefresh('/api/super-admin/hotels', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            const result = await response.json();

            if (!response.ok) {
                setError(result.error || 'حدث خطأ أثناء إنشاء الفندق');
                return;
            }

            setHotels((prev) => [result.hotel, ...prev]);
            reset();
        } catch (err) {
            setError('حدث خطأ في الاتصال بالخادم');
        } finally {
            setSubmitting(false);
        }
    };

    const toggleHotelStatus = async (hotelId: string, isActive: boolean) => {
        try {
            const response = await fetchWithRefresh(`/api/super-admin/hotels/${hotelId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: !isActive }),
            });

            const result = await response.json();
            if (!response.ok) {
                setError(result.error || 'تعذر تحديث حالة الفندق');
                return;
            }

            setHotels((prev) =>
                prev.map((hotel) =>
                    hotel._id === hotelId ? { ...hotel, isActive: result.data.isActive } : hotel
                )
            );
        } catch (err) {
            setError('حدث خطأ في الاتصال بالخادم');
        }
    };

    const planLabels: Record<string, string> = {
        free: 'مجاني',
        basic: 'أساسي',
        premium: 'احترافي',
        enterprise: 'مؤسسي',
    };

    const subscriptionLabels: Record<string, string> = {
        active: 'نشط',
        suspended: 'موقوف',
        cancelled: 'ملغي',
    };

    const formatDate = (value?: string) => {
        if (!value) return '—';
        return new Date(value).toLocaleDateString('ar-SA', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const filteredHotels = hotels.filter((hotel) => {
        if (statusFilter === 'active' && !hotel.isActive) return false;
        if (statusFilter === 'inactive' && hotel.isActive) return false;
        const plan = hotel.subscription?.plan || 'free';
        if (planFilter !== 'all' && plan !== planFilter) return false;
        return true;
    });

    const sortedHotels = [...filteredHotels].sort((a, b) => {
        let comparison = 0;
        if (sortBy === 'name') {
            comparison = a.name.localeCompare(b.name, 'ar');
        } else {
            comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        return sortDir === 'asc' ? comparison : -comparison;
    });

    const stats = useMemo(() => {
        const total = hotels.length;
        const active = hotels.filter((hotel) => hotel.isActive).length;
        const inactive = total - active;
        const premium = hotels.filter((hotel) => hotel.subscription?.plan === 'premium').length;
        const enterprise = hotels.filter((hotel) => hotel.subscription?.plan === 'enterprise').length;
        return { total, active, inactive, premium, enterprise };
    }, [hotels]);

    return (
        <div className="space-y-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white">
                        لوحة السوبر أدمن
                    </h1>
                    <p className="mt-1 text-white/60">
                        إدارة الفنادق والحسابات الرئيسية والتحكم بحالة الاشتراك
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Link href="/super-admin/users" className="btn-secondary text-sm">
                        <Users className="w-4 h-4" />
                        إدارة المستخدمين
                    </Link>
                    <button
                        type="button"
                        onClick={() => fetchHotels(search)}
                        className="btn-secondary text-sm"
                    >
                        <RefreshCcw className="w-4 h-4" />
                        تحديث البيانات
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-danger-500/10 border border-danger-500/20 rounded-xl text-danger-600 text-sm">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
                {[
                    { label: 'إجمالي الفنادق', value: stats.total, tone: 'text-primary-300' },
                    { label: 'فنادق نشطة', value: stats.active, tone: 'text-success-500' },
                    { label: 'غير نشطة', value: stats.inactive, tone: 'text-danger-500' },
                    { label: 'احترافي', value: stats.premium, tone: 'text-warning-500' },
                    { label: 'مؤسسي', value: stats.enterprise, tone: 'text-accent-300' },
                ].map((item) => (
                    <div key={item.label} className="card p-4">
                        <p className="text-xs text-white/50">{item.label}</p>
                        <p className={`text-lg font-semibold ${item.tone}`}>{item.value}</p>
                    </div>
                ))}
            </div>

            <div className="card p-6 space-y-6">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-primary-300" />
                    إضافة فندق جديد
                </h2>
                <p className="text-sm text-white/50">
                    سيتم إنشاء حساب مدير للفندق بالبريد الإلكتروني المدخل، ويمكن تعديل الصلاحيات من صفحة المستخدمين.
                </p>

                <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <input
                            {...register('hotelName')}
                            className="input"
                            placeholder="اسم الفندق"
                        />
                        {errors.hotelName && (
                            <p className="mt-1 text-sm text-danger-500">{errors.hotelName.message}</p>
                        )}
                    </div>
                    <div>
                        <input
                            {...register('adminName')}
                            className="input"
                            placeholder="اسم المدير"
                        />
                        {errors.adminName && (
                            <p className="mt-1 text-sm text-danger-500">{errors.adminName.message}</p>
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
                            {...register('phone')}
                            className="input"
                            placeholder="رقم الهاتف"
                            dir="ltr"
                        />
                        {errors.phone && (
                            <p className="mt-1 text-sm text-danger-500">{errors.phone.message}</p>
                        )}
                    </div>
                    <div>
                        <input
                            {...register('city')}
                            className="input"
                            placeholder="المدينة"
                        />
                        {errors.city && (
                            <p className="mt-1 text-sm text-danger-500">{errors.city.message}</p>
                        )}
                    </div>
                    <div>
                        <input
                            {...register('country')}
                            className="input"
                            placeholder="الدولة"
                        />
                        {errors.country && (
                            <p className="mt-1 text-sm text-danger-500">{errors.country.message}</p>
                        )}
                    </div>
                    <div className="md:col-span-2">
                        <input
                            {...register('password')}
                            type="password"
                            className="input"
                            placeholder="كلمة مرور المدير"
                            dir="ltr"
                        />
                        {errors.password && (
                            <p className="mt-1 text-sm text-danger-500">{errors.password.message}</p>
                        )}
                    </div>
                    <div className="md:col-span-2 flex justify-end">
                        <button type="submit" className="btn-primary" disabled={submitting}>
                            {submitting ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <Plus className="w-5 h-5" />
                                    <span>إضافة الفندق</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>

            <div className="card p-6 space-y-4">
                <div className="flex flex-col xl:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="input pr-10"
                            placeholder="ابحث باسم الفندق أو البريد..."
                        />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                            className="input min-w-[160px]"
                        >
                            <option value="all">كل الحالات</option>
                            <option value="active">نشط</option>
                            <option value="inactive">غير نشط</option>
                        </select>
                        <select
                            value={planFilter}
                            onChange={(e) => setPlanFilter(e.target.value as typeof planFilter)}
                            className="input min-w-[160px]"
                        >
                            <option value="all">كل الخطط</option>
                            <option value="free">مجاني</option>
                            <option value="basic">أساسي</option>
                            <option value="premium">احترافي</option>
                            <option value="enterprise">مؤسسي</option>
                        </select>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                            className="input min-w-[160px]"
                        >
                            <option value="createdAt">الأحدث</option>
                            <option value="name">الاسم</option>
                        </select>
                        <button
                            type="button"
                            onClick={() => setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                            className="btn-secondary text-sm"
                        >
                            <ArrowUpDown className="w-4 h-4" />
                            {sortDir === 'asc' ? 'تصاعدي' : 'تنازلي'}
                        </button>
                    </div>
                </div>
                <div className="text-xs text-white/50">
                    عرض {sortedHotels.length} من أصل {hotels.length} فندق
                </div>

                {loading ? (
                    <div className="flex justify-center py-8">
                        <div className="spinner w-10 h-10" />
                    </div>
                ) : sortedHotels.length === 0 ? (
                    <p className="text-white/60 text-center py-8">
                        لا توجد فنادق مطابقة للبحث
                    </p>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>الفندق</th>
                                    <th>المدينة</th>
                                    <th>البريد</th>
                                    <th>الخطة</th>
                                    <th>الاشتراك</th>
                                    <th>تاريخ الإنشاء</th>
                                    <th>الحالة</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedHotels.map((hotel) => (
                                    <tr key={hotel._id} className={!hotel.isActive ? 'bg-danger-500/5' : ''}>
                                        <td className="font-medium text-white">
                                            {hotel.name}
                                        </td>
                                        <td className="text-white/60">
                                            {hotel.address?.city || '-'}
                                        </td>
                                        <td className="text-white/60">
                                            {hotel.email}
                                        </td>
                                        <td>
                                            <span className="badge bg-white/10 text-white/70">
                                                {planLabels[hotel.subscription?.plan || 'free']}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="badge bg-white/10 text-white/70">
                                                {subscriptionLabels[hotel.subscription?.status || 'active']}
                                            </span>
                                        </td>
                                        <td className="text-white/60">
                                            {formatDate(hotel.createdAt)}
                                        </td>
                                        <td>
                                            {hotel.isActive ? (
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
                                                onClick={() => toggleHotelStatus(hotel._id, hotel.isActive)}
                                                className="btn-secondary text-xs"
                                            >
                                                {hotel.isActive ? 'تعطيل' : 'تفعيل'}
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
