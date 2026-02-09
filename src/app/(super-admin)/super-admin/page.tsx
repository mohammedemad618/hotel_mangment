'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Building2, Plus, Search, Loader2, CheckCircle, XCircle, Users, RefreshCcw, Settings2, Pencil } from 'lucide-react';
import { registerHotelSchema, RegisterHotelInput } from '@/lib/validations';
import { fetchWithRefresh } from '@/lib/fetchWithRefresh';

type PlatformRole = 'super_admin' | 'sub_super_admin';
type Plan = 'free' | 'basic' | 'premium' | 'enterprise';
type SubscriptionStatus = 'active' | 'suspended' | 'cancelled';

interface HotelAdmin {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    isActive: boolean;
}

interface HotelItem {
    _id: string;
    name: string;
    email: string;
    phone: string;
    address?: { city?: string; country?: string };
    subscription?: {
        plan?: Plan;
        status?: SubscriptionStatus;
        paymentDate?: string | null;
        endDate?: string | null;
    };
    verification?: { isVerified?: boolean };
    createdBy?: { name?: string } | null;
    admin?: HotelAdmin | null;
    isActive: boolean;
    createdAt: string;
}

interface SubscriptionForm {
    hotelId: string;
    isActive: boolean;
    plan: Plan;
    status: SubscriptionStatus;
    paymentDate: string;
    endDate: string;
}

interface AdminForm {
    hotelId: string;
    userId: string;
    name: string;
    email: string;
    phone: string;
    isActive: boolean;
}

const planLabels: Record<Plan, string> = {
    free: 'Free',
    basic: 'Basic',
    premium: 'Premium',
    enterprise: 'Enterprise',
};

const statusLabels: Record<SubscriptionStatus, string> = {
    active: 'Active',
    suspended: 'Suspended',
    cancelled: 'Cancelled',
};

const toDateInput = (value?: string | null) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
};

const formatDate = (value?: string | null) => {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
};

export default function SuperAdminPage() {
    const [role, setRole] = useState<PlatformRole | null>(null);
    const [hotels, setHotels] = useState<HotelItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [savingSubscription, setSavingSubscription] = useState(false);
    const [savingAdmin, setSavingAdmin] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [planFilter, setPlanFilter] = useState<'all' | Plan>('all');
    const [subscriptionForm, setSubscriptionForm] = useState<SubscriptionForm | null>(null);
    const [adminForm, setAdminForm] = useState<AdminForm | null>(null);

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<RegisterHotelInput>({ resolver: zodResolver(registerHotelSchema) });

    const isMainSuperAdmin = role === 'super_admin';

    const fetchMe = async () => {
        try {
            const response = await fetchWithRefresh('/api/auth/me');
            if (!response.ok) return;
            const data = await response.json();
            if (data.user?.role === 'super_admin' || data.user?.role === 'sub_super_admin') {
                setRole(data.user.role);
            }
        } catch {
            // layout handles auth
        }
    };

    const fetchHotels = async (searchValue = '') => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ limit: '200' });
            if (searchValue) params.set('search', searchValue);
            const response = await fetchWithRefresh(`/api/super-admin/hotels?${params}`);
            const data = await response.json();
            if (!response.ok) {
                setError(data.error || 'Failed to load hotels');
                return;
            }
            setHotels(Array.isArray(data.data) ? data.data : []);
        } catch {
            setError('Failed to load hotels');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMe();
        fetchHotels();
    }, []);

    useEffect(() => {
        const t = setTimeout(() => setSearch(searchInput.trim()), 300);
        return () => clearTimeout(t);
    }, [searchInput]);

    useEffect(() => {
        fetchHotels(search);
    }, [search]);

    const onCreateHotel = async (data: RegisterHotelInput) => {
        setError(null);
        setSuccess(null);
        setSubmitting(true);
        try {
            const response = await fetchWithRefresh('/api/super-admin/hotels', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const result = await response.json();
            if (!response.ok) {
                setError(result.error || 'Failed to create hotel');
                return;
            }
            setSuccess('Hotel and owner account created successfully');
            reset();
            await fetchHotels(search);
        } catch {
            setError('Server connection failed');
        } finally {
            setSubmitting(false);
        }
    };

    const patchHotel = async (hotelId: string, payload: Record<string, unknown>) => {
        const response = await fetchWithRefresh(`/api/super-admin/hotels/${hotelId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to update hotel');
        setHotels((prev) => prev.map((h) => (h._id === hotelId ? result.data : h)));
    };

    const toggleHotel = async (hotel: HotelItem) => {
        setError(null);
        setSuccess(null);
        try {
            await patchHotel(hotel._id, { isActive: !hotel.isActive });
            setSuccess('Activation status updated');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update hotel');
        }
    };

    const toggleVerify = async (hotel: HotelItem) => {
        setError(null);
        setSuccess(null);
        try {
            await patchHotel(hotel._id, { isVerified: !hotel.verification?.isVerified });
            setSuccess('Verification status updated');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update verification');
        }
    };

    const openSubscription = (hotel: HotelItem) => {
        setSubscriptionForm({
            hotelId: hotel._id,
            isActive: hotel.isActive,
            plan: hotel.subscription?.plan || 'basic',
            status: hotel.subscription?.status || 'active',
            paymentDate: toDateInput(hotel.subscription?.paymentDate),
            endDate: toDateInput(hotel.subscription?.endDate),
        });
    };

    const saveSubscription = async () => {
        if (!subscriptionForm) return;
        setSavingSubscription(true);
        setError(null);
        setSuccess(null);
        try {
            await patchHotel(subscriptionForm.hotelId, {
                isActive: subscriptionForm.isActive,
                subscription: {
                    plan: subscriptionForm.plan,
                    status: subscriptionForm.status,
                    paymentDate: subscriptionForm.paymentDate || null,
                    endDate: subscriptionForm.endDate || null,
                },
            });
            setSubscriptionForm(null);
            setSuccess('Subscription details saved');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save subscription');
        } finally {
            setSavingSubscription(false);
        }
    };

    const openAdmin = (hotel: HotelItem) => {
        if (!hotel.admin) {
            setError('No hotel owner account found for this hotel');
            return;
        }
        setAdminForm({
            hotelId: hotel._id,
            userId: hotel.admin._id,
            name: hotel.admin.name,
            email: hotel.admin.email,
            phone: hotel.admin.phone || '',
            isActive: hotel.admin.isActive,
        });
    };

    const saveAdmin = async () => {
        if (!adminForm) return;
        setSavingAdmin(true);
        setError(null);
        setSuccess(null);
        try {
            const response = await fetchWithRefresh(`/api/super-admin/users/${adminForm.userId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: adminForm.name,
                    email: adminForm.email,
                    phone: adminForm.phone.trim() || null,
                    isActive: adminForm.isActive,
                }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Failed to update owner account');
            setSuccess('Owner account updated');
            setAdminForm(null);
            await fetchHotels(search);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update owner account');
        } finally {
            setSavingAdmin(false);
        }
    };

    const filteredHotels = useMemo(() => hotels.filter((hotel) => {
        if (statusFilter === 'active' && !hotel.isActive) return false;
        if (statusFilter === 'inactive' && hotel.isActive) return false;
        if (planFilter !== 'all' && (hotel.subscription?.plan || 'free') !== planFilter) return false;
        if (search && !`${hotel.name} ${hotel.email}`.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    }), [hotels, statusFilter, planFilter, search]);

    const stats = useMemo(() => ({
        total: hotels.length,
        active: hotels.filter((h) => h.isActive).length,
        verified: hotels.filter((h) => h.verification?.isVerified).length,
    }), [hotels]);

    return (
        <div className="space-y-6">
            <section className="page-hero">
                <div className="page-hero-content flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-white">Hotels & Subscriptions Control</h1>
                        <p className="mt-2 text-white/60">Create hotel owners, manage subscriptions, and handle verification lifecycle.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Link href="/super-admin/users" className="btn-secondary text-sm">
                            <Users className="w-4 h-4" />
                            Users Management
                        </Link>
                        <button type="button" onClick={() => fetchHotels(search)} className="btn-secondary text-sm">
                            <RefreshCcw className="w-4 h-4" />
                            Refresh
                        </button>
                    </div>
                </div>
            </section>

            {(error || success) && (
                <div className="space-y-2">
                    {error && <div className="p-3 bg-danger-500/10 border border-danger-500/20 rounded-xl text-danger-600 text-sm">{error}</div>}
                    {success && <div className="p-3 bg-success-500/10 border border-success-500/20 rounded-xl text-success-500 text-sm">{success}</div>}
                </div>
            )}

            <div className="grid grid-cols-3 gap-3">
                <div className="stat-card"><p className="text-xs text-white/50">Total Hotels</p><p className="text-lg font-semibold text-primary-300">{stats.total}</p></div>
                <div className="stat-card"><p className="text-xs text-white/50">Active Accounts</p><p className="text-lg font-semibold text-success-500">{stats.active}</p></div>
                <div className="stat-card"><p className="text-xs text-white/50">Verified Hotels</p><p className="text-lg font-semibold text-accent-300">{stats.verified}</p></div>
            </div>

            <div className="card p-5 space-y-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Building2 className="w-5 h-5 text-primary-300" />Create New Hotel</h2>
                <form onSubmit={handleSubmit(onCreateHotel)} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                    <input {...register('hotelName')} className="input-compact w-full" placeholder="Hotel name" />
                    <input {...register('adminName')} className="input-compact w-full" placeholder="Owner name" />
                    <input {...register('email')} type="email" className="input-compact w-full" placeholder="Email" dir="ltr" />
                    <input {...register('phone')} className="input-compact w-full" placeholder="Phone" dir="ltr" />
                    <input {...register('city')} className="input-compact w-full" placeholder="City" />
                    <input {...register('country')} className="input-compact w-full" placeholder="Country" />
                    <div className="md:col-span-2 xl:col-span-2">
                        <input {...register('password')} type="password" className="input-compact w-full" placeholder="Owner password" dir="ltr" />
                    </div>
                    <div className="md:col-span-2 xl:col-span-4 flex justify-end">
                        <button type="submit" className="btn-primary text-sm" disabled={submitting}>
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" />Create hotel</>}
                        </button>
                    </div>
                </form>
                {(errors.hotelName || errors.adminName || errors.email || errors.password) && (
                    <p className="text-xs text-danger-500">Check required fields and try again.</p>
                )}
            </div>

            <div className="card p-5 space-y-4">
                <div className="flex flex-col lg:flex-row gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                        <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="input-compact w-full pr-9" placeholder="Search by hotel or email" />
                    </div>
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="input-compact min-w-[120px]">
                        <option value="all">All status</option><option value="active">Active</option><option value="inactive">Inactive</option>
                    </select>
                    <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value as typeof planFilter)} className="input-compact min-w-[120px]">
                        <option value="all">All plans</option><option value="free">Free</option><option value="basic">Basic</option><option value="premium">Premium</option><option value="enterprise">Enterprise</option>
                    </select>
                </div>

                {loading ? (
                    <div className="flex justify-center py-8"><div className="spinner w-9 h-9" /></div>
                ) : filteredHotels.length === 0 ? (
                    <p className="text-white/60 text-center py-8">No hotels matched your filters.</p>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead><tr><th>Hotel</th><th>Owner</th><th>Subscription</th><th>Payment/Expiry</th><th>Status</th>{isMainSuperAdmin && <th>Verify</th>}<th>Actions</th></tr></thead>
                            <tbody>
                                {filteredHotels.map((hotel) => (
                                    <tr key={hotel._id}>
                                        <td><p className="font-medium text-white">{hotel.name}</p><p className="text-xs text-white/50">{hotel.address?.city || '-'}</p></td>
                                        <td>{hotel.admin ? <><p className="font-medium text-white text-sm">{hotel.admin.name}</p><p className="text-xs text-white/60" dir="ltr">{hotel.admin.email}</p></> : <span className="text-xs text-warning-500">Missing owner</span>}</td>
                                        <td><p className="text-xs">{planLabels[hotel.subscription?.plan || 'free']}</p><p className="text-xs text-white/60">{statusLabels[hotel.subscription?.status || 'active']}</p></td>
                                        <td><p className="text-xs">Payment: {formatDate(hotel.subscription?.paymentDate)}</p><p className="text-xs text-white/60">Expiry: {formatDate(hotel.subscription?.endDate)}</p></td>
                                        <td>{hotel.isActive ? <span className="badge-success inline-flex items-center gap-1"><CheckCircle className="w-3 h-3" />Active</span> : <span className="badge-danger inline-flex items-center gap-1"><XCircle className="w-3 h-3" />Inactive</span>}</td>
                                        {isMainSuperAdmin && <td>{hotel.verification?.isVerified ? <span className="badge-success">Verified</span> : <span className="badge-warning">Pending</span>}</td>}
                                        <td>
                                            <div className="flex flex-wrap gap-1">
                                                <button className="btn-secondary text-xs" onClick={() => toggleHotel(hotel)}>{hotel.isActive ? 'Disable' : 'Enable'}</button>
                                                <button className="btn-secondary text-xs" onClick={() => openSubscription(hotel)}><Settings2 className="w-3.5 h-3.5" />Subscription</button>
                                                <button className="btn-secondary text-xs" onClick={() => openAdmin(hotel)}><Pencil className="w-3.5 h-3.5" />Owner</button>
                                                {isMainSuperAdmin && <button className="btn-secondary text-xs" onClick={() => toggleVerify(hotel)}>{hotel.verification?.isVerified ? 'Unverify' : 'Verify'}</button>}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {subscriptionForm && (
                <div className="card p-5 space-y-3">
                    <h3 className="text-base font-semibold text-white">Edit Subscription</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <label className="surface-tile flex items-center justify-between text-sm">Account active<input type="checkbox" checked={subscriptionForm.isActive} onChange={(e) => setSubscriptionForm((prev) => prev ? { ...prev, isActive: e.target.checked } : prev)} /></label>
                        <select value={subscriptionForm.plan} onChange={(e) => setSubscriptionForm((prev) => prev ? { ...prev, plan: e.target.value as Plan } : prev)} className="input-compact w-full"><option value="free">Free</option><option value="basic">Basic</option><option value="premium">Premium</option><option value="enterprise">Enterprise</option></select>
                        <select value={subscriptionForm.status} onChange={(e) => setSubscriptionForm((prev) => prev ? { ...prev, status: e.target.value as SubscriptionStatus } : prev)} className="input-compact w-full"><option value="active">Active</option><option value="suspended">Suspended</option><option value="cancelled">Cancelled</option></select>
                        <input type="date" value={subscriptionForm.paymentDate} onChange={(e) => setSubscriptionForm((prev) => prev ? { ...prev, paymentDate: e.target.value } : prev)} className="input-compact w-full" />
                        <input type="date" value={subscriptionForm.endDate} onChange={(e) => setSubscriptionForm((prev) => prev ? { ...prev, endDate: e.target.value } : prev)} className="input-compact w-full" />
                    </div>
                    <div className="flex justify-end gap-2"><button className="btn-secondary text-sm" onClick={() => setSubscriptionForm(null)}>Close</button><button className="btn-primary text-sm" onClick={saveSubscription} disabled={savingSubscription}>{savingSubscription ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save subscription'}</button></div>
                </div>
            )}

            {adminForm && (
                <div className="card p-5 space-y-3">
                    <h3 className="text-base font-semibold text-white">Edit Hotel Owner Account</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input value={adminForm.name} onChange={(e) => setAdminForm((prev) => prev ? { ...prev, name: e.target.value } : prev)} className="input-compact w-full" placeholder="Name" />
                        <input value={adminForm.email} onChange={(e) => setAdminForm((prev) => prev ? { ...prev, email: e.target.value } : prev)} className="input-compact w-full" placeholder="Email" dir="ltr" />
                        <input value={adminForm.phone} onChange={(e) => setAdminForm((prev) => prev ? { ...prev, phone: e.target.value } : prev)} className="input-compact w-full" placeholder="Phone" dir="ltr" />
                        <label className="surface-tile flex items-center justify-between text-sm">Account active<input type="checkbox" checked={adminForm.isActive} onChange={(e) => setAdminForm((prev) => prev ? { ...prev, isActive: e.target.checked } : prev)} /></label>
                    </div>
                    <div className="flex justify-end gap-2"><button className="btn-secondary text-sm" onClick={() => setAdminForm(null)}>Close</button><button className="btn-primary text-sm" onClick={saveAdmin} disabled={savingAdmin}>{savingAdmin ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save account'}</button></div>
                </div>
            )}
        </div>
    );
}
