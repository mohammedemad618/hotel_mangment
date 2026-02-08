'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useHotelSettings } from '@/app/(dashboard)/layout';
import {
    Plus,
    Search,
    Users,
    User,
    Phone,
    Mail,
    Crown,
    Building2,
    Eye,
    LayoutGrid,
    List,
    ArrowUpDown,
    CalendarCheck,
    DollarSign,
    ShieldAlert,
} from 'lucide-react';

interface Guest {
    _id: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone: string;
    nationality: string;
    idType: string;
    idNumber: string;
    guestType: string;
    companyName?: string;
    totalStays: number;
    totalSpent: number;
    lastStay?: string;
    createdAt?: string;
    isBlacklisted: boolean;
}

const guestTypeConfig: Record<string, { label: string; color: string; icon: any }> = {
    individual: { label: 'فردي', color: 'badge-primary', icon: User },
    corporate: { label: 'شركات', color: 'badge bg-accent-500/15 text-accent-300', icon: Building2 },
    vip: { label: 'VIP', color: 'badge bg-warning-500/15 text-warning-500', icon: Crown },
};

export default function GuestsPage() {
    const { settings: hotelSettings } = useHotelSettings();
    const [guests, setGuests] = useState<Guest[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [showBlacklisted, setShowBlacklisted] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [sortBy, setSortBy] = useState<'name' | 'spent' | 'stays' | 'recent'>('name');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

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

    useEffect(() => {
        const timer = setTimeout(() => {
            setSearch(searchInput.trim());
        }, 350);
        return () => clearTimeout(timer);
    }, [searchInput]);

    useEffect(() => {
        fetchGuests();
    }, [typeFilter, search]);

    const fetchGuests = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (typeFilter) params.set('guestType', typeFilter);
            if (search) params.set('search', search);

            const response = await fetchWithRefresh(`/api/guests?${params}`);
            const data = await response.json();

            if (data.success) {
                setGuests(data.data);
            }
        } catch (error) {
            console.error('Error fetching guests:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '—';
        const locale = hotelSettings?.language === 'en' ? 'en-US' : 'ar-SA';
        const timeZone = hotelSettings?.timezone || 'Asia/Riyadh';
        return new Date(dateStr).toLocaleDateString(locale, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            timeZone,
        });
    };

    const formatCurrency = (amount: number) => {
        const locale = hotelSettings?.language === 'en' ? 'en-US' : 'ar-SA';
        const currency = hotelSettings?.currency || 'SAR';
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency,
            minimumFractionDigits: 0,
        }).format(amount);
    };

    const filteredGuests = guests.filter((guest) => {
        if (showBlacklisted && !guest.isBlacklisted) return false;
        if (!searchInput.trim()) return true;
        const query = searchInput.trim().toLowerCase();
        const fullName = `${guest.firstName} ${guest.lastName}`.toLowerCase();
        return (
            fullName.includes(query) ||
            guest.phone?.toLowerCase().includes(query) ||
            guest.email?.toLowerCase().includes(query) ||
            guest.idNumber?.toLowerCase().includes(query) ||
            guest.companyName?.toLowerCase().includes(query)
        );
    });

    const sortedGuests = [...filteredGuests].sort((a, b) => {
        let comparison = 0;
        if (sortBy === 'spent') {
            comparison = (a.totalSpent || 0) - (b.totalSpent || 0);
        } else if (sortBy === 'stays') {
            comparison = (a.totalStays || 0) - (b.totalStays || 0);
        } else if (sortBy === 'recent') {
            const aDate = new Date(a.lastStay || a.createdAt || 0).getTime();
            const bDate = new Date(b.lastStay || b.createdAt || 0).getTime();
            comparison = aDate - bDate;
        } else {
            const nameA = `${a.lastName || ''} ${a.firstName || ''}`.trim().toLowerCase();
            const nameB = `${b.lastName || ''} ${b.firstName || ''}`.trim().toLowerCase();
            comparison = nameA.localeCompare(nameB);
        }
        return sortDir === 'asc' ? comparison : -comparison;
    });

    const stats = {
        total: filteredGuests.length,
        vip: filteredGuests.filter((guest) => guest.guestType === 'vip').length,
        corporate: filteredGuests.filter((guest) => guest.guestType === 'corporate').length,
        blacklisted: filteredGuests.filter((guest) => guest.isBlacklisted).length,
        stays: filteredGuests.reduce((sum, guest) => sum + (guest.totalStays || 0), 0),
        revenue: filteredGuests.reduce((sum, guest) => sum + (guest.totalSpent || 0), 0),
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">
                        إدارة النزلاء
                    </h1>
                    <p className="mt-1 text-white/60">
                        قاعدة بيانات النزلاء وسجلاتهم
                    </p>
                </div>
                <Link href="/dashboard/guests/new" className="btn-primary">
                    <Plus className="w-5 h-5" />
                    <span>إضافة نزيل</span>
                </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                {[
                    { label: 'إجمالي النزلاء', value: stats.total, icon: Users, tone: 'text-primary-300' },
                    { label: 'نزلاء VIP', value: stats.vip, icon: Crown, tone: 'text-warning-500' },
                    { label: 'شركات', value: stats.corporate, icon: Building2, tone: 'text-accent-300' },
                    { label: 'قائمة سوداء', value: stats.blacklisted, icon: ShieldAlert, tone: 'text-danger-500' },
                    { label: 'إجمالي الإقامات', value: stats.stays, icon: CalendarCheck, tone: 'text-primary-300' },
                    { label: 'إجمالي الإنفاق', value: formatCurrency(stats.revenue), icon: DollarSign, tone: 'text-success-500' },
                ].map((item) => (
                    <div key={item.label} className="card p-4 flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                            <item.icon className={`w-5 h-5 ${item.tone}`} />
                        </div>
                        <div>
                            <p className="text-xs text-white/50">{item.label}</p>
                            <p className="text-lg font-semibold text-white">{item.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="card p-4">
                <div className="flex flex-col xl:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                        <input
                            type="text"
                            placeholder="ابحث بالاسم أو الهاتف أو البريد أو رقم الهوية..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="input pr-10"
                        />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                            className="input min-w-[160px]"
                        >
                            <option value="">جميع الأنواع</option>
                            <option value="individual">أفراد</option>
                            <option value="corporate">شركات</option>
                            <option value="vip">VIP</option>
                        </select>
                        <button
                            type="button"
                            onClick={() => setShowBlacklisted((prev) => !prev)}
                            className={`btn-secondary text-sm ${showBlacklisted ? 'bg-danger-500/20 text-danger-500 border-danger-500/30' : ''}`}
                        >
                            <ShieldAlert className="w-4 h-4" />
                            القائمة السوداء
                        </button>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                            className="input min-w-[160px]"
                        >
                            <option value="name">الاسم</option>
                            <option value="spent">الإنفاق</option>
                            <option value="stays">الإقامات</option>
                            <option value="recent">آخر إقامة</option>
                        </select>
                        <button
                            type="button"
                            onClick={() => setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                            className="btn-secondary text-sm"
                        >
                            <ArrowUpDown className="w-4 h-4" />
                            {sortDir === 'asc' ? 'تصاعدي' : 'تنازلي'}
                        </button>
                        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-1">
                            <button
                                type="button"
                                onClick={() => setViewMode('grid')}
                                className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition ${viewMode === 'grid'
                                    ? 'bg-primary-500/20 text-white'
                                    : 'text-white/60 hover:text-white'
                                    }`}
                            >
                                <LayoutGrid className="w-4 h-4" />
                                شبكة
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('list')}
                                className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition ${viewMode === 'list'
                                    ? 'bg-primary-500/20 text-white'
                                    : 'text-white/60 hover:text-white'
                                    }`}
                            >
                                <List className="w-4 h-4" />
                                قائمة
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setSearchInput('');
                                setTypeFilter('');
                                setShowBlacklisted(false);
                                setSortBy('name');
                                setSortDir('asc');
                            }}
                            className="btn-secondary text-sm"
                        >
                            إعادة تعيين
                        </button>
                    </div>
                </div>
                <div className="mt-3 text-xs text-white/50">
                    عرض {sortedGuests.length} من أصل {guests.length} نزيل
                </div>
            </div>

            {/* Guests Grid */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="spinner w-10 h-10" />
                </div>
            ) : sortedGuests.length === 0 ? (
                <div className="card p-12 text-center">
                    <Users className="w-16 h-16 mx-auto text-white/30" />
                    <p className="mt-4 text-white/60">
                        لا يوجد نزلاء{searchInput ? ' يطابقون البحث' : ''}.
                    </p>
                    <Link href="/dashboard/guests/new" className="btn-primary mt-4 inline-flex">
                        <Plus className="w-5 h-5" />
                        <span>إضافة نزيل جديد</span>
                    </Link>
                </div>
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {sortedGuests.map((guest, index) => {
                        const guestType = guestTypeConfig[guest.guestType] || guestTypeConfig.individual;
                        const TypeIcon = guestType.icon;

                        return (
                            <div
                                key={guest._id}
                                className={`card p-5 hover:shadow-card-hover transition-shadow animate-slide-up ${guest.isBlacklisted ? 'border-2 border-danger-500' : ''
                                    }`}
                                style={{ animationDelay: `${index * 50}ms` }}
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 bg-primary-500/15 rounded-xl">
                                            <User className="w-6 h-6 text-primary-300" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-white">
                                                {guest.firstName} {guest.lastName}
                                            </h3>
                                            <p className="text-sm text-white/50">{guest.nationality}</p>
                                        </div>
                                    </div>
                                    <span className={guestType.color}>
                                        <TypeIcon className="w-3 h-3 ml-1 inline" />
                                        {guestType.label}
                                    </span>
                                </div>

                                <div className="space-y-2 text-sm">
                                    <div className="flex items-center gap-2 text-white/60">
                                        <Phone className="w-4 h-4" />
                                        <span dir="ltr">{guest.phone}</span>
                                    </div>
                                    {guest.email && (
                                        <div className="flex items-center gap-2 text-white/60">
                                            <Mail className="w-4 h-4" />
                                            <span dir="ltr" className="truncate">{guest.email}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between text-white/60">
                                        <span>الهوية</span>
                                        <span className="text-white">{guest.idNumber}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-white/60">
                                        <span>آخر إقامة</span>
                                        <span className="text-white">{formatDate(guest.lastStay)}</span>
                                    </div>
                                </div>

                                <div className="mt-4 pt-4 border-t border-white/5 flex justify-between text-sm">
                                    <div>
                                        <span className="text-white/50">الإقامات</span>
                                        <p className="font-semibold text-white">
                                            {guest.totalStays}
                                        </p>
                                    </div>
                                    <div className="text-left">
                                        <span className="text-white/50">الإنفاق</span>
                                        <p className="font-semibold text-success-500">
                                            {formatCurrency(guest.totalSpent)}
                                        </p>
                                    </div>
                                </div>

                                <Link
                                    href={`/dashboard/guests/${guest._id}`}
                                    className="btn-secondary w-full mt-4 text-sm"
                                >
                                    <Eye className="w-4 h-4" />
                                    <span>عرض التفاصيل</span>
                                </Link>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>النزيل</th>
                                <th>النوع</th>
                                <th>الهاتف</th>
                                <th>البريد</th>
                                <th>الإقامات</th>
                                <th>الإنفاق</th>
                                <th>آخر إقامة</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedGuests.map((guest, index) => {
                                const guestType = guestTypeConfig[guest.guestType] || guestTypeConfig.individual;
                                const TypeIcon = guestType.icon;

                                return (
                                    <tr
                                        key={guest._id}
                                        className="animate-slide-up"
                                        style={{ animationDelay: `${index * 30}ms` }}
                                    >
                                        <td>
                                            <div>
                                                <p className="font-medium text-white">
                                                    {guest.firstName} {guest.lastName}
                                                </p>
                                                <p className="text-xs text-white/50">{guest.nationality}</p>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={guestType.color}>
                                                <TypeIcon className="w-3 h-3 ml-1 inline" />
                                                {guestType.label}
                                            </span>
                                        </td>
                                        <td dir="ltr" className="text-white/60">{guest.phone}</td>
                                        <td dir="ltr" className="text-white/60">{guest.email || '—'}</td>
                                        <td className="text-white/60">{guest.totalStays}</td>
                                        <td className="font-medium text-success-500">{formatCurrency(guest.totalSpent)}</td>
                                        <td className="text-white/60">{formatDate(guest.lastStay)}</td>
                                        <td>
                                            <Link
                                                href={`/dashboard/guests/${guest._id}`}
                                                className="p-2 rounded-lg hover:bg-white/10 inline-flex"
                                            >
                                                <Eye className="w-4 h-4 text-white/60" />
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
