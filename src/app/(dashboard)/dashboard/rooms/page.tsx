'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
    Plus,
    Search,
    BedDouble,
    LayoutGrid,
    List,
    Check,
    Wrench,
    Sparkles,
    Building2,
    Users,
    DollarSign,
    Hash,
    CalendarCheck,
    XCircle,
    ArrowUpDown,
} from 'lucide-react';
import { useHotelSettings } from '@/app/(dashboard)/layout';
import { fetchWithRefresh } from '@/lib/fetchWithRefresh';
import { normalizeLanguage, t } from '@/lib/i18n';

interface Room {
    _id: string;
    roomNumber: string;
    floor: number;
    type: string;
    status: string;
    pricePerNight: number;
    capacity: { adults: number; children: number };
    amenities: string[];
    isActive?: boolean;
}

const statusConfig: Record<string, { label: { ar: string; en: string }; color: string; icon: any }> = {
    available: { label: { ar: 'متاحة', en: 'Available' }, color: 'badge-success', icon: Check },
    occupied: { label: { ar: 'مشغولة', en: 'Occupied' }, color: 'badge-primary', icon: BedDouble },
    reserved: { label: { ar: 'محجوزة', en: 'Reserved' }, color: 'badge-warning', icon: CalendarCheck },
    maintenance: { label: { ar: 'صيانة', en: 'Maintenance' }, color: 'badge-danger', icon: Wrench },
    cleaning: { label: { ar: 'تنظيف', en: 'Cleaning' }, color: 'badge-primary', icon: Sparkles },
    inactive: { label: { ar: 'غير نشطة', en: 'Inactive' }, color: 'badge bg-white/10 text-white/60', icon: XCircle },
};

const typeLabels: Record<string, { ar: string; en: string }> = {
    single: { ar: 'مفردة', en: 'Single' },
    double: { ar: 'مزدوجة', en: 'Double' },
    twin: { ar: 'توأم', en: 'Twin' },
    suite: { ar: 'جناح', en: 'Suite' },
    deluxe: { ar: 'فاخرة', en: 'Deluxe' },
    presidential: { ar: 'رئاسية', en: 'Presidential' },
};

const statusOrder: Record<string, number> = {
    available: 1,
    occupied: 2,
    reserved: 3,
    cleaning: 4,
    maintenance: 5,
    inactive: 6,
};

export default function RoomsPage() {
    const { settings: hotelSettings } = useHotelSettings();
    const lang = normalizeLanguage(hotelSettings?.language);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [floorFilter, setFloorFilter] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [sortBy, setSortBy] = useState<'roomNumber' | 'price' | 'floor' | 'status'>('roomNumber');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

    useEffect(() => {
        fetchRooms();
    }, [statusFilter]);

    const fetchRooms = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (statusFilter) params.set('status', statusFilter);

            const response = await fetchWithRefresh(`/api/rooms?${params}`);
            const data = await response.json();

            if (data.success) {
                setRooms(data.data);
            }
        } catch (error) {
            console.error('Error fetching rooms:', error);
        } finally {
            setLoading(false);
        }
    };

    const stats = useMemo(() => {
        const total = rooms.length;
        const available = rooms.filter((room) => room.status === 'available' && room.isActive !== false).length;
        const occupied = rooms.filter((room) => room.status === 'occupied' && room.isActive !== false).length;
        const reserved = rooms.filter((room) => room.status === 'reserved' && room.isActive !== false).length;
        const maintenance = rooms.filter((room) => ['maintenance', 'cleaning'].includes(room.status) && room.isActive !== false).length;
        const inactive = rooms.filter((room) => room.isActive === false).length;

        return { total, available, occupied, reserved, maintenance, inactive };
    }, [rooms]);

    const floors = useMemo(() => {
        const unique = Array.from(new Set(rooms.map((room) => room.floor))).sort((a, b) => a - b);
        return unique.map((floor) => floor.toString());
    }, [rooms]);

    const formatCurrency = (amount: number) => {
        const locale = hotelSettings?.language === 'en' ? 'en-US' : 'ar-SA';
        const currency = hotelSettings?.currency || 'SAR';
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency,
            minimumFractionDigits: 0,
        }).format(amount);
    };

    const filteredRooms = useMemo(() => {
        const query = search.trim().toLowerCase();
        return rooms.filter((room) => {
            if (statusFilter === 'inactive') {
                if (room.isActive !== false) return false;
            } else if (statusFilter && room.status !== statusFilter) {
                return false;
            }

            if (typeFilter && room.type !== typeFilter) return false;
            if (floorFilter && room.floor.toString() !== floorFilter) return false;

            if (!query) return true;
            const typeLabel = typeLabels[room.type]?.[lang] || room.type;
            return (
                room.roomNumber.toLowerCase().includes(query) ||
                typeLabel.toLowerCase().includes(query) ||
                room.floor.toString().includes(query)
            );
        });
    }, [rooms, search, statusFilter, typeFilter, floorFilter, lang]);

    const sortedRooms = useMemo(() => {
        const sorted = [...filteredRooms];
        sorted.sort((a, b) => {
            let comparison = 0;
            if (sortBy === 'roomNumber') {
                comparison = a.roomNumber.localeCompare(b.roomNumber, undefined, {
                    numeric: true,
                    sensitivity: 'base',
                });
            } else if (sortBy === 'price') {
                comparison = a.pricePerNight - b.pricePerNight;
            } else if (sortBy === 'floor') {
                comparison = a.floor - b.floor;
            } else if (sortBy === 'status') {
                const statusA = a.isActive === false ? 'inactive' : a.status;
                const statusB = b.isActive === false ? 'inactive' : b.status;
                comparison = (statusOrder[statusA] || 99) - (statusOrder[statusB] || 99);
            }
            return sortDir === 'asc' ? comparison : -comparison;
        });
        return sorted;
    }, [filteredRooms, sortBy, sortDir]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">
                        {t(lang, 'إدارة الغرف', 'Room Management')}
                    </h1>
                    <p className="mt-1 text-white/60">
                        {t(lang, 'تابع حالة الغرف وأدر التسعير والتوافر بسهولة.', 'Track room status, pricing, and availability.')}
                    </p>
                </div>
                <Link href="/dashboard/rooms/new" className="btn-primary">
                    <Plus className="w-5 h-5" />
                    <span>{t(lang, 'إضافة غرفة', 'Add Room')}</span>
                </Link>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
                {[
                    { id: 'total', label: t(lang, 'إجمالي الغرف', 'Total Rooms'), value: stats.total, icon: Building2, tone: 'text-primary-300' },
                    { id: 'available', label: statusConfig.available.label[lang], value: stats.available, icon: Check, tone: 'text-success-500' },
                    { id: 'occupied', label: statusConfig.occupied.label[lang], value: stats.occupied, icon: BedDouble, tone: 'text-primary-300' },
                    { id: 'reserved', label: statusConfig.reserved.label[lang], value: stats.reserved, icon: CalendarCheck, tone: 'text-warning-500' },
                    { id: 'maintenance', label: t(lang, 'صيانة/تنظيف', 'Maintenance/Cleaning'), value: stats.maintenance, icon: Wrench, tone: 'text-danger-500' },
                ].map((item) => (
                    <div key={item.id} className="card p-4 flex items-center gap-3">
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
                            placeholder={t(lang, 'ابحث برقم الغرفة أو النوع أو الطابق...', 'Search by room number, type, or floor...')}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="input pr-10"
                        />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="input min-w-[150px]"
                        >
                            <option value="">{t(lang, 'كل الحالات', 'All statuses')}</option>
                            <option value="available">{statusConfig.available.label[lang]}</option>
                            <option value="occupied">{statusConfig.occupied.label[lang]}</option>
                            <option value="reserved">{statusConfig.reserved.label[lang]}</option>
                            <option value="maintenance">{statusConfig.maintenance.label[lang]}</option>
                            <option value="cleaning">{statusConfig.cleaning.label[lang]}</option>
                            <option value="inactive">{statusConfig.inactive.label[lang]}</option>
                        </select>
                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                            className="input min-w-[150px]"
                        >
                            <option value="">{t(lang, 'كل الأنواع', 'All types')}</option>
                            {Object.entries(typeLabels).map(([value, label]) => (
                                <option key={value} value={value}>{label[lang]}</option>
                            ))}
                        </select>
                        <select
                            value={floorFilter}
                            onChange={(e) => setFloorFilter(e.target.value)}
                            className="input min-w-[120px]"
                        >
                            <option value="">{t(lang, 'كل الطوابق', 'All floors')}</option>
                            {floors.map((floor) => (
                                <option key={floor} value={floor}>
                                    {t(lang, `الطابق ${floor}`, `Floor ${floor}`)}
                                </option>
                            ))}
                        </select>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                            className="input min-w-[140px]"
                        >
                            <option value="roomNumber">{t(lang, 'ترتيب حسب رقم الغرفة', 'Sort by room #')}</option>
                            <option value="price">{t(lang, 'ترتيب حسب السعر', 'Sort by price')}</option>
                            <option value="floor">{t(lang, 'ترتيب حسب الطابق', 'Sort by floor')}</option>
                            <option value="status">{t(lang, 'ترتيب حسب الحالة', 'Sort by status')}</option>
                        </select>
                        <button
                            type="button"
                            onClick={() => setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                            className="btn-secondary text-sm"
                        >
                            <ArrowUpDown className="w-4 h-4" />
                            {sortDir === 'asc'
                                ? t(lang, 'تصاعدي', 'Ascending')
                                : t(lang, 'تنازلي', 'Descending')}
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
                    </div>
                </div>
                <div className="mt-3 text-xs text-white/50">
                    {t(
                        lang,
                        `عرض ${sortedRooms.length} من أصل ${rooms.length} غرفة`,
                        `Showing ${sortedRooms.length} of ${rooms.length} rooms`
                    )}
                </div>
            </div>

            {/* Rooms Grid */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="spinner w-10 h-10" />
                </div>
            ) : sortedRooms.length === 0 ? (
                <div className="card p-12 text-center">
                    <BedDouble className="w-16 h-16 mx-auto text-white/30" />
                    <p className="mt-4 text-white/60">
                        {t(
                            lang,
                            `لا توجد غرف${search ? ' مطابقة للبحث' : ''}.`,
                            `No rooms${search ? ' match your search' : ''}.`
                        )}
                    </p>
                    <Link href="/dashboard/rooms/new" className="btn-primary mt-4 inline-flex">
                        <Plus className="w-5 h-5" />
                        <span>{t(lang, 'إضافة غرفة جديدة', 'Add New Room')}</span>
                    </Link>
                </div>
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {sortedRooms.map((room, index) => {
                        const statusKey = room.isActive === false ? 'inactive' : room.status;
                        const status = statusConfig[statusKey] || statusConfig.available;
                        const StatusIcon = status.icon;
                        const capacityLabel = lang === 'en'
                            ? `${room.capacity.adults} adults${room.capacity.children > 0 ? ` + ${room.capacity.children} children` : ''}`
                            : `${room.capacity.adults} بالغ${room.capacity.children > 0 ? ` + ${room.capacity.children} طفل` : ''}`;

                        return (
                            <div
                                key={room._id}
                                className="card p-5 hover:shadow-card-hover transition-shadow animate-slide-up"
                                style={{ animationDelay: `${index * 50}ms` }}
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <p className="text-xs text-white/40">{t(lang, 'رقم الغرفة', 'Room #')}</p>
                                        <h3 className="text-xl font-bold text-white">
                                            {room.roomNumber}
                                        </h3>
                                        <p className="text-sm text-white/50">
                                            {t(lang, `الطابق ${room.floor}`, `Floor ${room.floor}`)} - {typeLabels[room.type]?.[lang] || room.type}
                                        </p>
                                    </div>
                                    <span className={status.color}>
                                        <StatusIcon className="w-3 h-3 ml-1 inline" />
                                        {status.label[lang]}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div className="flex items-center gap-2 text-white/60">
                                        <DollarSign className="w-4 h-4" />
                                        <span className="font-medium text-primary-300">
                                            {formatCurrency(room.pricePerNight)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-white/60">
                                        <Users className="w-4 h-4" />
                                        <span>{capacityLabel}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-white/60">
                                        <Sparkles className="w-4 h-4" />
                                        <span>
                                            {t(
                                                lang,
                                                `${room.amenities?.length || 0} مرافق`,
                                                `${room.amenities?.length || 0} amenities`
                                            )}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-white/60">
                                        <Hash className="w-4 h-4" />
                                        <span>{room.type.toUpperCase()}</span>
                                    </div>
                                </div>

                                <div className="mt-4 pt-4 border-t border-white/5">
                                    <Link
                                        href={`/dashboard/rooms/${room._id}`}
                                        className="btn-secondary w-full text-sm"
                                    >
                                        {t(lang, 'عرض التفاصيل', 'View Details')}
                                    </Link>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>{t(lang, 'رقم الغرفة', 'Room #')}</th>
                                <th>{t(lang, 'الطابق', 'Floor')}</th>
                                <th>{t(lang, 'النوع', 'Type')}</th>
                                <th>{t(lang, 'السعر/ليلة', 'Price/night')}</th>
                                <th>{t(lang, 'السعة', 'Capacity')}</th>
                                <th>{t(lang, 'المرافق', 'Amenities')}</th>
                                <th>{t(lang, 'الحالة', 'Status')}</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedRooms.map((room, index) => {
                                const statusKey = room.isActive === false ? 'inactive' : room.status;
                                const status = statusConfig[statusKey] || statusConfig.available;
                                const StatusIcon = status.icon;

                                return (
                                    <tr
                                        key={room._id}
                                        className="animate-slide-up"
                                        style={{ animationDelay: `${index * 20}ms` }}
                                    >
                                        <td className="font-medium text-white">{room.roomNumber}</td>
                                        <td className="text-white/60">{room.floor}</td>
                                        <td className="text-white/60">{typeLabels[room.type]?.[lang] || room.type}</td>
                                        <td className="text-primary-300">{formatCurrency(room.pricePerNight)}</td>
                                        <td className="text-white/60">
                                            {lang === 'en'
                                                ? `${room.capacity.adults} adults${room.capacity.children > 0 ? ` + ${room.capacity.children} children` : ''}`
                                                : `${room.capacity.adults} بالغ${room.capacity.children > 0 ? ` + ${room.capacity.children} طفل` : ''}`}
                                        </td>
                                        <td className="text-white/60">{room.amenities?.length || 0}</td>
                                        <td>
                                            <span className={status.color}>
                                                <StatusIcon className="w-3 h-3 ml-1 inline" />
                                                {status.label[lang]}
                                            </span>
                                        </td>
                                        <td>
                                            <Link
                                                href={`/dashboard/rooms/${room._id}`}
                                                className="btn-secondary text-xs"
                                            >
                                                {t(lang, 'تفاصيل', 'Details')}
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
