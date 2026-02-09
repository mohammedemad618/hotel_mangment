'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useHotelSettings } from '@/app/(dashboard)/layout';
import { fetchWithRefresh } from '@/lib/fetchWithRefresh';
import { normalizeLanguage, t } from '@/lib/i18n';
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

const guestTypeConfig: Record<string, { label: { ar: string; en: string }; color: string; icon: any }> = {
    individual: { label: { ar: 'فردي', en: 'Individual' }, color: 'badge-primary', icon: User },
    corporate: { label: { ar: 'شركات', en: 'Corporate' }, color: 'badge bg-accent-500/15 text-accent-300', icon: Building2 },
    vip: { label: { ar: 'VIP', en: 'VIP' }, color: 'badge bg-warning-500/15 text-warning-500', icon: Crown },
};

export default function GuestsPage() {
    const { settings: hotelSettings } = useHotelSettings();
    const lang = normalizeLanguage(hotelSettings?.language);
    const [guests, setGuests] = useState<Guest[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [showBlacklisted, setShowBlacklisted] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [sortBy, setSortBy] = useState<'name' | 'spent' | 'stays' | 'recent'>('name');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

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
        if (!dateStr) return '-';
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
        <div className="space-y-7">
            {/* Header */}
            <div className="page-hero flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="relative z-10 flex items-center gap-4">
                    <div className="stat-icon">
                        <Users className="w-6 h-6 text-primary-300" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">
                        {t(lang, 'إدارة النزلاء', 'Guest Management')}
                    </h1>
                    <p className="mt-1 text-white/60">
                        {t(lang, 'قاعدة بيانات النزلاء وسجلاتهم', 'Guest database and history')}
                    </p>
                    </div>
                </div>
                <Link href="/dashboard/guests/new" className="btn-primary relative z-10">
                    <Plus className="w-5 h-5" />
                    <span>{t(lang, 'إضافة نزيل', 'Add Guest')}</span>
                </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                {[
                    { id: 'total', label: t(lang, 'إجمالي النزلاء', 'Total guests'), value: stats.total, icon: Users, tone: 'text-primary-300' },
                    { id: 'vip', label: t(lang, 'نزلاء VIP', 'VIP guests'), value: stats.vip, icon: Crown, tone: 'text-warning-500' },
                    { id: 'corporate', label: guestTypeConfig.corporate.label[lang], value: stats.corporate, icon: Building2, tone: 'text-accent-300' },
                    { id: 'blacklisted', label: t(lang, 'قائمة سوداء', 'Blacklisted'), value: stats.blacklisted, icon: ShieldAlert, tone: 'text-danger-500' },
                    { id: 'stays', label: t(lang, 'إجمالي الإقامات', 'Total stays'), value: stats.stays, icon: CalendarCheck, tone: 'text-primary-300' },
                    { id: 'revenue', label: t(lang, 'إجمالي الإنفاق', 'Total spend'), value: formatCurrency(stats.revenue), icon: DollarSign, tone: 'text-success-500' },
                ].map((item) => (
                    <div key={item.id} className="stat-card flex items-center gap-3">
                        <div className="stat-icon">
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
            <div className="filter-shell">
                <div className="flex flex-col xl:flex-row xl:items-start gap-3">
                    <div className="flex-1 relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                        <input
                            type="text"
                            placeholder={t(lang, 'ابحث بالاسم أو الهاتف أو البريد أو رقم الهوية...', 'Search by name, phone, email, or ID...')}
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="input pr-10"
                        />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                            className="input-compact min-w-[135px]"
                        >
                            <option value="">{t(lang, 'جميع الأنواع', 'All types')}</option>
                            <option value="individual">{guestTypeConfig.individual.label[lang]}</option>
                            <option value="corporate">{guestTypeConfig.corporate.label[lang]}</option>
                            <option value="vip">{guestTypeConfig.vip.label[lang]}</option>
                        </select>
                        <button
                            type="button"
                            onClick={() => setShowBlacklisted((prev) => !prev)}
                            className={`btn-secondary text-sm px-3 py-2 ${showBlacklisted ? 'bg-danger-500/20 text-danger-500 border-danger-500/30' : ''}`}
                        >
                            <ShieldAlert className="w-4 h-4" />
                            {t(lang, 'القائمة السوداء', 'Blacklist')}
                        </button>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                            className="input-compact min-w-[135px]"
                        >
                            <option value="name">{t(lang, 'الاسم', 'Name')}</option>
                            <option value="spent">{t(lang, 'الإنفاق', 'Spend')}</option>
                            <option value="stays">{t(lang, 'الإقامات', 'Stays')}</option>
                            <option value="recent">{t(lang, 'آخر إقامة', 'Last stay')}</option>
                        </select>
                        <button
                            type="button"
                            onClick={() => setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                            className="btn-secondary text-sm px-3 py-2"
                        >
                            <ArrowUpDown className="w-4 h-4" />
                            {sortDir === 'asc'
                                ? t(lang, 'تصاعدي', 'Ascending')
                                : t(lang, 'تنازلي', 'Descending')}
                        </button>
                        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-1">
                            <button
                                type="button"
                                onClick={() => setViewMode('grid')}
                                className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition ${viewMode === 'grid'
                                    ? 'bg-primary-500/20 text-white'
                                    : 'text-white/60 hover:text-white'
                                    }`}
                            >
                                <LayoutGrid className="w-4 h-4" />
                                {t(lang, 'شبكة', 'Grid')}
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
                                {t(lang, 'قائمة', 'List')}
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
                            className="btn-secondary text-sm px-3 py-2"
                        >
                            {t(lang, 'إعادة تعيين', 'Reset')}
                        </button>
                    </div>
                </div>
                <div className="mt-3 text-xs text-white/50">
                    {t(
                        lang,
                        `عرض ${sortedGuests.length} من أصل ${guests.length} نزيل`,
                        `Showing ${sortedGuests.length} of ${guests.length} guests`
                    )}
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
                        {t(
                            lang,
                            `لا يوجد نزلاء${searchInput ? ' يطابقون البحث' : ''}.`,
                            `No guests${searchInput ? ' match your search' : ''}.`
                        )}
                    </p>
                    <Link href="/dashboard/guests/new" className="btn-primary mt-4 inline-flex">
                        <Plus className="w-5 h-5" />
                        <span>{t(lang, 'إضافة نزيل جديد', 'Add New Guest')}</span>
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
                                className={`card p-5 relative overflow-hidden border border-white/10 hover:shadow-card-hover transition-shadow animate-slide-up ${guest.isBlacklisted ? 'border-2 border-danger-500' : ''
                                    }`}
                                style={{ animationDelay: `${index * 50}ms` }}
                            >
                                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-primary-500/0 via-primary-500/70 to-accent-500/0" />
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="stat-icon">
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
                                        {guestType.label[lang]}
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
                                        <span>{t(lang, 'الهوية', 'ID')}</span>
                                        <span className="text-white">{guest.idNumber}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-white/60">
                                        <span>{t(lang, 'آخر إقامة', 'Last stay')}</span>
                                        <span className="text-white">{formatDate(guest.lastStay)}</span>
                                    </div>
                                </div>

                                <div className="mt-4 pt-4 border-t border-white/10 flex justify-between text-sm">
                                    <div>
                                        <span className="text-white/50">{t(lang, 'الإقامات', 'Stays')}</span>
                                        <p className="font-semibold text-white">
                                            {guest.totalStays}
                                        </p>
                                    </div>
                                    <div className="text-left">
                                        <span className="text-white/50">{t(lang, 'الإنفاق', 'Spend')}</span>
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
                                    <span>{t(lang, 'عرض التفاصيل', 'View Details')}</span>
                                </Link>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="table-container shadow-card">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>{t(lang, 'النزيل', 'Guest')}</th>
                                <th>{t(lang, 'النوع', 'Type')}</th>
                                <th>{t(lang, 'الهاتف', 'Phone')}</th>
                                <th>{t(lang, 'البريد', 'Email')}</th>
                                <th>{t(lang, 'الإقامات', 'Stays')}</th>
                                <th>{t(lang, 'الإنفاق', 'Spend')}</th>
                                <th>{t(lang, 'آخر إقامة', 'Last stay')}</th>
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
                                                {guestType.label[lang]}
                                            </span>
                                        </td>
                                        <td dir="ltr" className="text-white/60">{guest.phone}</td>
                                        <td dir="ltr" className="text-white/60">{guest.email || '-'}</td>
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

