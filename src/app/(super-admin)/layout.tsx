'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    Building2,
    LayoutDashboard,
    LogOut,
    Menu,
    X,
    ChevronLeft,
    User,
    Search,
} from 'lucide-react';

interface UserData {
    id: string;
    name: string;
    email: string;
    role: string;
}

const navigation = [
    { name: 'الفنادق', href: '/super-admin', icon: LayoutDashboard },
    { name: 'المستخدمون', href: '/super-admin/users', icon: User },
];

export default function SuperAdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [user, setUser] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);

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
                if (data.user?.role !== 'super_admin') {
                    router.push('/dashboard');
                    return;
                }
                setUser(data.user);
            } catch (error) {
                router.push('/login');
            } finally {
                setLoading(false);
            }
        };

        fetchUser();
    }, [router]);

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
                className={`fixed inset-y-0 right-0 z-50 w-72 bg-[rgba(10,8,22,0.92)] border-l border-white/5 shadow-2xl backdrop-blur-xl transform transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
                    }`}
            >
                <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between h-16 px-6 border-b border-white/5">
                        <Link href="/super-admin" className="flex items-center gap-3">
                            <div className="p-2 bg-primary-500/20 border border-primary-500/30 rounded-lg">
                                <Building2 className="w-6 h-6 text-primary-300" />
                            </div>
                            <span className="font-semibold text-white">Super Admin</span>
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

            <div className="lg:mr-72">
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
                                placeholder="ابحث عن فندق أو مستخدم..."
                            />
                        </div>
                        <div className="flex-1 md:flex-none" />
                        <span className="text-xs text-white/50 hidden sm:inline">إدارة النظام</span>
                    </div>
                </header>

                <main className="p-4 sm:p-6 lg:p-8">
                    {children}
                </main>
            </div>
        </div>
    );
}
