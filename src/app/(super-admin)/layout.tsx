'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    Building2,
    LayoutDashboard,
    LogOut,
    Menu,
    X,
    ChevronLeft,
    Users,
    Search,
    ShieldCheck,
    Activity,
} from 'lucide-react';
import { fetchWithRefresh } from '@/lib/fetchWithRefresh';

interface UserData {
    id: string;
    name: string;
    email: string;
    role: 'super_admin' | 'sub_super_admin' | string;
}

const navigation = [
    { name: 'الفنادق والاشتراكات', href: '/super-admin', icon: LayoutDashboard },
    { name: 'المستخدمون والصلاحيات', href: '/super-admin/users', icon: Users },
    { name: 'مراقبة الصب سوبر أدمن', href: '/super-admin/sub-super-admins', icon: Activity },
];

function getRoleLabel(role?: string): string {
    if (role === 'super_admin') return 'سوبر أدمن رئيسي';
    if (role === 'sub_super_admin') return 'صب سوبر أدمن';
    return 'مدير المنصة';
}

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

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const response = await fetchWithRefresh('/api/auth/me');
                if (!response.ok) {
                    router.push('/login');
                    return;
                }

                const data = await response.json();
                const role = data.user?.role;
                if (role !== 'super_admin' && role !== 'sub_super_admin') {
                    router.push('/dashboard');
                    return;
                }

                setUser(data.user);
            } catch {
                router.push('/login');
            } finally {
                setLoading(false);
            }
        };

        fetchUser();
    }, [router]);

    const activeItemTitle = useMemo(() => {
        const match = navigation.find((item) => pathname === item.href || pathname.startsWith(item.href + '/'));
        return match?.name || 'لوحة إدارة المنصة';
    }, [pathname]);

    const visibleNavigation = useMemo(() => {
        return navigation.filter((item) => {
            if (item.href === '/super-admin/sub-super-admins') {
                return user?.role === 'super_admin';
            }
            return true;
        });
    }, [user?.role]);

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
                className={`fixed inset-y-0 right-0 z-50 w-72 bg-[color:var(--app-surface-strong)] border-l border-white/10 shadow-card backdrop-blur-xl transform transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}
            >
                <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between h-16 px-6 border-b border-white/5">
                        <Link href="/super-admin" className="flex items-center gap-3">
                            <div className="p-2 bg-primary-500/20 border border-primary-500/40 rounded-lg shadow-glass">
                                <Building2 className="w-6 h-6 text-primary-300" />
                            </div>
                            <span className="font-semibold text-white">إدارة المنصة</span>
                        </Link>
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className="lg:hidden p-2 rounded-lg hover:bg-white/10"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
                        {visibleNavigation.map((item) => {
                            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 border ${isActive
                                        ? 'bg-primary-500/15 text-white border-primary-500/40'
                                        : 'text-white/60 border-transparent hover:bg-white/5 hover:text-white'}`}
                                >
                                    <item.icon className="w-5 h-5" />
                                    <span className="font-medium">{item.name}</span>
                                    {isActive && <ChevronLeft className="w-4 h-4 mr-auto text-primary-200" />}
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="p-4 border-t border-white/5 space-y-3">
                        <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                            <div className="flex items-center gap-2 text-xs text-white/50 mb-2">
                                <ShieldCheck className="w-4 h-4" />
                                مستوى الحساب
                            </div>
                            <p className="text-sm text-white font-medium">{getRoleLabel(user?.role)}</p>
                        </div>

                        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                            <div className="p-2 bg-primary-500/20 rounded-full">
                                <Users className="w-5 h-5 text-primary-300" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">{user?.name}</p>
                                <p className="text-xs text-white/50 truncate">{user?.email}</p>
                            </div>
                        </div>

                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-danger-500 hover:bg-danger-500/10 transition-colors"
                        >
                            <LogOut className="w-5 h-5" />
                            <span className="font-medium">تسجيل الخروج</span>
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
                                placeholder="بحث في الفنادق أو الحسابات..."
                                readOnly
                                value=""
                            />
                        </div>
                        <div className="flex-1 md:flex-none" />
                        <div className="text-end hidden sm:block">
                            <p className="text-xs text-white/50">تحكم مركزي كامل بالمنصة</p>
                            <p className="text-sm font-medium text-white/90">{activeItemTitle}</p>
                        </div>
                    </div>
                </header>

                <main className="p-4 sm:p-6 lg:p-8">
                    {children}
                </main>
            </div>
        </div>
    );
}
