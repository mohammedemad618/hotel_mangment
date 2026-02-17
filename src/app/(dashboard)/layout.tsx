'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    Building2,
    LayoutDashboard,
    BedDouble,
    CalendarCheck,
    Users,
    Settings,
    LogOut,
    Menu,
    X,
    ChevronLeft,
    User,
    Search,
    Wallet,
    BarChart3,
    Bell,
} from 'lucide-react';
import { fetchWithRefresh } from '@/lib/fetchWithRefresh';
import { normalizeLanguage, t } from '@/lib/i18n';
import type { HotelNotificationType } from '@/core/notifications/types';
import type { HotelNotificationCategory } from '@/core/notifications/catalog';

export interface HotelSettings {
    currency: string;
    timezone: string;
    language: 'ar' | 'en';
    checkInTime: string;
    checkOutTime: string;
    taxRate: number;
    theme?: 'light' | 'dark' | 'system';
    notifications?: {
        newBooking: boolean;
        cancelledBooking: boolean;
        paymentReceived: boolean;
        dailyReport: boolean;
        subscriptionExpiry?: boolean;
    };
}

export interface HotelProfile {
    name?: string;
    email?: string;
    phone?: string;
    logo?: string;
    address?: {
        street?: string;
        city?: string;
        country?: string;
        postalCode?: string;
    };
}

export interface HotelNotification {
    id: string;
    type: HotelNotificationType;
    category: HotelNotificationCategory;
    message: string;
    createdAt: string;
    isRead: boolean;
    readAt: string | null;
    actionUrl: string | null;
}

interface UserData {
    id: string;
    name: string;
    email: string;
    role: string;
    hotelId: string | null;
    hotel?: {
        name?: string;
        email?: string;
        phone?: string;
        logo?: string;
        address?: {
            street?: string;
            city?: string;
            country?: string;
            postalCode?: string;
        };
        settings?: HotelSettings;
        notificationsLog?: HotelNotification[];
    };
}

interface HotelSettingsContextValue {
    settings: HotelSettings | null;
    setSettings: (next: HotelSettings | null) => void;
    notifications: HotelNotification[];
    setNotifications: (
        next: HotelNotification[] | ((prev: HotelNotification[]) => HotelNotification[])
    ) => void;
    hotelProfile: HotelProfile | null;
    setHotelProfile: (next: HotelProfile | null) => void;
}

const SettingsContext = createContext<HotelSettingsContextValue>({
    settings: null,
    setSettings: () => {},
    notifications: [],
    setNotifications: () => {},
    hotelProfile: null,
    setHotelProfile: () => {},
});

export const useHotelSettings = () => useContext(SettingsContext);

const navigation = [
    { name: { ar: 'لوحة التحكم', en: 'Dashboard' }, href: '/dashboard', icon: LayoutDashboard },
    { name: { ar: 'الغرف', en: 'Rooms' }, href: '/dashboard/rooms', icon: BedDouble },
    { name: { ar: 'الحجوزات', en: 'Bookings' }, href: '/dashboard/bookings', icon: CalendarCheck },
    { name: { ar: 'النزلاء', en: 'Guests' }, href: '/dashboard/guests', icon: Users },
    { name: { ar: 'المالية', en: 'Finance' }, href: '/dashboard/finance', icon: Wallet },
    { name: { ar: 'التقارير', en: 'Reports' }, href: '/dashboard/reports', icon: BarChart3 },
    { name: { ar: 'الإعدادات', en: 'Settings' }, href: '/dashboard/settings', icon: Settings },
];

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [user, setUser] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState<HotelSettings | null>(null);
    const [notifications, setNotifications] = useState<HotelNotification[]>([]);
    const [hotelProfile, setHotelProfile] = useState<HotelProfile | null>(null);

    const lang = normalizeLanguage(settings?.language);
    const language = settings?.language;
    const theme = settings?.theme;

    const unreadNotifications = useMemo(
        () => notifications.filter((item) => !item.isRead).length,
        [notifications]
    );

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const response = await fetchWithRefresh('/api/auth/me');
                if (!response.ok) {
                    router.push('/login');
                    return;
                }

                const data = await response.json();
                setUser(data.user);

                const hotelSettings = data.user?.hotel?.settings || {};
                setHotelProfile({
                    name: data.user?.hotel?.name,
                    email: data.user?.hotel?.email,
                    phone: data.user?.hotel?.phone,
                    logo: data.user?.hotel?.logo,
                    address: data.user?.hotel?.address,
                });

                const hotelNotifications = Array.isArray(data.user?.hotel?.notificationsLog)
                    ? data.user.hotel.notificationsLog
                    : [];

                setSettings({
                    currency: hotelSettings.currency || 'SAR',
                    timezone: hotelSettings.timezone || 'Asia/Riyadh',
                    language: hotelSettings.language || 'ar',
                    checkInTime: hotelSettings.checkInTime || '14:00',
                    checkOutTime: hotelSettings.checkOutTime || '12:00',
                    taxRate: typeof hotelSettings.taxRate === 'number' ? hotelSettings.taxRate : 15,
                    theme: hotelSettings.theme || 'dark',
                    notifications: {
                        newBooking: hotelSettings.notifications?.newBooking ?? true,
                        cancelledBooking: hotelSettings.notifications?.cancelledBooking ?? true,
                        paymentReceived: hotelSettings.notifications?.paymentReceived ?? true,
                        dailyReport: hotelSettings.notifications?.dailyReport ?? true,
                        subscriptionExpiry: hotelSettings.notifications?.subscriptionExpiry ?? true,
                    },
                });

                setNotifications(hotelNotifications);
            } catch {
                router.push('/login');
            } finally {
                setLoading(false);
            }
        };

        fetchUser();
    }, [router]);

    useEffect(() => {
        if (!language) return;

        const root = document.documentElement;
        root.lang = language === 'en' ? 'en' : 'ar';
        root.dir = language === 'en' ? 'ltr' : 'rtl';

        const applyTheme = (nextTheme: 'light' | 'dark') => {
            root.classList.remove('light', 'dark');
            root.classList.add(nextTheme);
        };

        if (theme === 'system') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            const syncTheme = () => applyTheme(mediaQuery.matches ? 'dark' : 'light');
            syncTheme();
            mediaQuery.addEventListener('change', syncTheme);
            return () => mediaQuery.removeEventListener('change', syncTheme);
        }

        applyTheme(theme === 'light' || theme === 'dark' ? theme : 'dark');
    }, [language, theme]);

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="spinner w-12 h-12" />
            </div>
        );
    }

    return (
        <div className="min-h-screen text-white/90">
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/60 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <aside
                className={`fixed inset-y-0 right-0 z-50 w-72 bg-[color:var(--app-surface-strong)] border-l border-white/10 shadow-card backdrop-blur-xl transform transition-transform duration-300 lg:translate-x-0 ${
                    sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
                }`}
            >
                <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between h-16 px-6 border-b border-white/5">
                        <Link href="/dashboard" className="flex items-center gap-3">
                            <div className="p-2 bg-primary-500/20 border border-primary-500/40 rounded-lg shadow-glass">
                                <Building2 className="w-6 h-6 text-primary-300" />
                            </div>
                            <span className="font-semibold text-white">HMS Console</span>
                        </Link>
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className="lg:hidden p-2 rounded-lg hover:bg-white/10"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
                        {navigation.map((item) => {
                            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 border ${
                                        isActive
                                            ? 'bg-primary-500/15 text-white border-primary-500/40'
                                            : 'text-white/60 border-transparent hover:bg-white/5 hover:text-white'
                                    }`}
                                >
                                    <item.icon className="w-5 h-5" />
                                    <span className="font-medium">{item.name[lang]}</span>
                                    {isActive && <ChevronLeft className="w-4 h-4 mr-auto text-primary-200" />}
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="p-4 border-t border-white/5">
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                            <div className="p-2 bg-primary-500/20 rounded-full">
                                <User className="w-5 h-5 text-primary-300" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">{user?.name}</p>
                                <p className="text-xs text-white/50 truncate">{user?.email}</p>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="mt-3 flex items-center gap-3 w-full px-4 py-3 rounded-xl text-danger-500 hover:bg-danger-500/10 transition-colors"
                        >
                            <LogOut className="w-5 h-5" />
                            <span className="font-medium">{t(lang, 'تسجيل الخروج', 'Logout')}</span>
                        </button>
                    </div>
                </div>
            </aside>

            <div className="lg:mr-72">
                <header className="sticky top-0 z-30 bg-[color:var(--app-surface)] backdrop-blur-xl border-b border-white/10">
                    <div className="flex items-center h-16 px-4 sm:px-6 lg:px-8 gap-4">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="lg:hidden p-2 rounded-lg hover:bg-white/10"
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                        <div className="hidden md:flex items-center gap-2 bg-[color:var(--app-surface-strong)] border border-white/10 rounded-xl px-3 py-2 flex-1 max-w-xl">
                            <Search className="w-4 h-4 text-white/40" />
                            <input
                                className="bg-transparent text-sm text-white/80 placeholder-white/40 focus:outline-none w-full"
                                placeholder={t(
                                    lang,
                                    'ابحث عن غرفة، نزيل، أو حجز...',
                                    'Search for a room, guest, or booking...'
                                )}
                            />
                        </div>

                        <div className="flex-1 md:flex-none" />

                        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-xs text-white/70">
                            <Bell className="w-4 h-4 text-primary-300" />
                            <span>
                                {t(lang, 'غير المقروءة', 'Unread')}: {unreadNotifications}
                            </span>
                        </div>

                        <span className="text-xs text-white/50 hidden sm:inline">
                            {t(lang, 'الإصدار الاحترافي', 'Pro Edition')}
                        </span>
                    </div>
                </header>

                <SettingsContext.Provider
                    value={{ settings, setSettings, notifications, setNotifications, hotelProfile, setHotelProfile }}
                >
                    <main className="p-4 sm:p-6 lg:p-8">{children}</main>
                </SettingsContext.Provider>
            </div>
        </div>
    );
}
