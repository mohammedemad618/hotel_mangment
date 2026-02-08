'use client';

import { createContext, useContext, useEffect, useState } from 'react';
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
} from 'lucide-react';

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
    type: 'booking_new' | 'booking_cancelled' | 'payment_received' | 'daily_report';
    message: string;
    createdAt: string;
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
    { name: 'لوحة التحكم', href: '/dashboard', icon: LayoutDashboard },
    { name: 'الغرف', href: '/dashboard/rooms', icon: BedDouble },
    { name: 'الحجوزات', href: '/dashboard/bookings', icon: CalendarCheck },
    { name: 'النزلاء', href: '/dashboard/guests', icon: Users },
    { name: 'المالية', href: '/dashboard/finance', icon: Wallet },
    { name: 'الإعدادات', href: '/dashboard/settings', icon: Settings },
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
                    },
                });
                setNotifications(hotelNotifications);
            } catch (error) {
                router.push('/login');
            } finally {
                setLoading(false);
            }
        };

        fetchUser();
    }, [router]);

    useEffect(() => {
        if (!settings) {
            return;
        }

        const root = document.documentElement;
        root.lang = settings.language === 'en' ? 'en' : 'ar';
        root.dir = settings.language === 'en' ? 'ltr' : 'rtl';

        const applyTheme = (theme: 'light' | 'dark') => {
            root.classList.remove('light', 'dark');
            root.classList.add(theme);
        };

        if (settings.theme === 'system') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            const syncTheme = () => applyTheme(mediaQuery.matches ? 'dark' : 'light');
            syncTheme();
            mediaQuery.addEventListener('change', syncTheme);
            return () => mediaQuery.removeEventListener('change', syncTheme);
        }

        applyTheme(settings.theme || 'dark');
    }, [settings?.language, settings?.theme]);

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
            {/* Mobile sidebar overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/60 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`fixed inset-y-0 right-0 z-50 w-72 bg-[rgba(10,8,22,0.92)] border-l border-white/5 shadow-2xl backdrop-blur-xl transform transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
                    }`}
            >
                <div className="flex flex-col h-full">
                    {/* Logo */}
                    <div className="flex items-center justify-between h-16 px-6 border-b border-white/5">
                        <Link href="/dashboard" className="flex items-center gap-3">
                            <div className="p-2 bg-primary-500/20 border border-primary-500/30 rounded-lg">
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

                    {/* Navigation */}
                    <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
                        {navigation.map((item) => {
                            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 border ${isActive
                                            ? 'bg-primary-500/15 text-white border-primary-500/40'
                                            : 'text-white/60 border-transparent hover:bg-white/5 hover:text-white'
                                        }`}
                                >
                                    <item.icon className="w-5 h-5" />
                                    <span className="font-medium">{item.name}</span>
                                    {isActive && <ChevronLeft className="w-4 h-4 mr-auto text-primary-200" />}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* User */}
                    <div className="p-4 border-t border-white/5">
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                            <div className="p-2 bg-primary-500/20 rounded-full">
                                <User className="w-5 h-5 text-primary-300" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">
                                    {user?.name}
                                </p>
                                <p className="text-xs text-white/50 truncate">
                                    {user?.email}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="mt-3 flex items-center gap-3 w-full px-4 py-3 rounded-xl text-danger-500 hover:bg-danger-500/10 transition-colors"
                        >
                            <LogOut className="w-5 h-5" />
                            <span className="font-medium">تسجيل الخروج</span>
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main content */}
            <div className="lg:mr-72">
                {/* Header */}
                <header className="sticky top-0 z-30 bg-[rgba(10,8,22,0.86)] backdrop-blur-xl border-b border-white/5">
                    <div className="flex items-center h-16 px-4 sm:px-6 lg:px-8 gap-4">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="lg:hidden p-2 rounded-lg hover:bg-white/10"
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                        <div className="hidden md:flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 flex-1 max-w-xl">
                            <Search className="w-4 h-4 text-white/40" />
                            <input
                                className="bg-transparent text-sm text-white/80 placeholder-white/40 focus:outline-none w-full"
                                placeholder="ابحث عن غرفة، نزيل، أو حجز..."
                            />
                        </div>
                        <div className="flex-1 md:flex-none" />
                        <span className="text-xs text-white/50 hidden sm:inline">الإصدار الاحترافي</span>
                    </div>
                </header>

                {/* Page content */}
                <SettingsContext.Provider value={{ settings, setSettings, notifications, setNotifications, hotelProfile, setHotelProfile }}>
                    <main className="p-4 sm:p-6 lg:p-8">
                        {children}
                    </main>
                </SettingsContext.Provider>
            </div>
        </div>
    );
}
