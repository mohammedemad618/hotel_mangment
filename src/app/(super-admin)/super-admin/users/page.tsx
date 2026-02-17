'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
    AlertTriangle,
    Building2,
    CheckCircle,
    Loader2,
    Pencil,
    Plus,
    RefreshCcw,
    Search,
    Trash2,
    UserCog,
    Users,
    XCircle,
} from 'lucide-react';
import { createUserSchema, CreateUserInput } from '@/lib/validations';
import { fetchWithRefresh } from '@/lib/fetchWithRefresh';

interface HotelOption {
    _id: string;
    name: string;
}

interface UserItem {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    role: string;
    hotelId: string | null;
    hotel?: { name?: string };
    createdBy?: { name?: string };
    isActive: boolean;
}

interface EditUserForm {
    userId: string;
    name: string;
    email: string;
    phone: string;
    isActive: boolean;
}

interface DeleteUserForm {
    userId: string;
    name: string;
    email: string;
    role: string;
}


const roleLabels: Record<string, string> = {
    super_admin: 'Ø³ÙˆØ¨Ø± Ø£Ø¯Ù…Ù† Ø±Ø¦ÙŠØ³ÙŠ',
    sub_super_admin: 'ØµØ¨ Ø³ÙˆØ¨Ø± Ø£Ø¯Ù…Ù†',
    admin: 'Ù…Ø¯ÙŠØ± Ø§Ù„ÙÙ†Ø¯Ù‚',
    manager: 'Ù…Ø¯ÙŠØ± ØªØ´ØºÙŠÙ„ÙŠ',
    receptionist: 'Ù…ÙˆØ¸Ù Ø§Ø³ØªÙ‚Ø¨Ø§Ù„',
    housekeeping: 'Ø¥Ø´Ø±Ø§Ù Ù†Ø¸Ø§ÙØ©',
    accountant: 'Ù…Ø­Ø§Ø³Ø¨',
};

const allCreationRoles = ['sub_super_admin', 'admin', 'manager', 'receptionist', 'housekeeping', 'accountant'];
const subCreationRoles = ['admin', 'manager', 'receptionist', 'housekeeping', 'accountant'];


export default function SuperAdminUsersPage() {
    const [currentRole, setCurrentRole] = useState<'super_admin' | 'sub_super_admin' | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    const [users, setUsers] = useState<UserItem[]>([]);
    const [hotels, setHotels] = useState<HotelOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [savingEdit, setSavingEdit] = useState(false);
    const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [hotelFilter, setHotelFilter] = useState('');

    const [editForm, setEditForm] = useState<EditUserForm | null>(null);
    const [deleteForm, setDeleteForm] = useState<DeleteUserForm | null>(null);
    const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');

    const {
        register,
        handleSubmit,
        reset,
        watch,
        formState: { errors },
    } = useForm<CreateUserInput>({
        resolver: zodResolver(createUserSchema),
        defaultValues: { role: 'admin' },
    });

    const selectedRole = watch('role');
    const canDeleteUsers = currentRole === 'super_admin';

    const loadCurrentUser = async () => {
        try {
            const response = await fetchWithRefresh('/api/auth/me');
            if (!response.ok) return;
            const data = await response.json();
            if (data.user?.role === 'super_admin' || data.user?.role === 'sub_super_admin') {
                setCurrentRole(data.user.role);
                setCurrentUserId(data.user.id || null);
            }
        } catch {
            // layout handles auth redirection
        }
    };

    const fetchHotels = async () => {
        try {
            const response = await fetchWithRefresh('/api/super-admin/hotels?limit=200');
            const data = await response.json();
            if (!response.ok) {
                setError(data.error || 'ØªØ¹Ø°Ø± ØªØ­Ù…ÙŠÙ„ Ø§Ù„ÙÙ†Ø§Ø¯Ù‚');
                return;
            }
            setHotels(Array.isArray(data.data) ? data.data : []);
        } catch {
            setError('ØªØ¹Ø°Ø± ØªØ­Ù…ÙŠÙ„ Ø§Ù„ÙÙ†Ø§Ø¯Ù‚');
        }
    };

    const fetchUsers = async (params?: { search?: string; role?: string; hotelId?: string }) => {
        try {
            const query = new URLSearchParams({ limit: '200' });
            if (params?.search) query.set('search', params.search);
            if (params?.role) query.set('role', params.role);
            if (params?.hotelId) query.set('hotelId', params.hotelId);

            const response = await fetchWithRefresh(`/api/super-admin/users?${query}`);
            const data = await response.json();
            if (!response.ok) {
                setError(data.error || 'ØªØ¹Ø°Ø± ØªØ­Ù…ÙŠÙ„ Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…ÙŠÙ†');
                return;
            }
            setUsers(Array.isArray(data.data) ? data.data : []);
        } catch {
            setError('ØªØ¹Ø°Ø± ØªØ­Ù…ÙŠÙ„ Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…ÙŠÙ†');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCurrentUser();
        fetchHotels();
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            setSearch(searchInput.trim());
        }, 300);
        return () => clearTimeout(timer);
    }, [searchInput]);

    useEffect(() => {
        setLoading(true);
        fetchUsers({ search, role: roleFilter, hotelId: hotelFilter });
    }, [search, roleFilter, hotelFilter]);

    const createRoles = useMemo(() => {
        return currentRole === 'sub_super_admin' ? subCreationRoles : allCreationRoles;
    }, [currentRole]);

    const userStats = useMemo(() => {
        return {
            total: users.length,
            active: users.filter((item) => item.isActive).length,
            inactive: users.filter((item) => !item.isActive).length,
            platform: users.filter((item) => item.role === 'super_admin' || item.role === 'sub_super_admin').length,
        };
    }, [users]);

    const onSubmit = async (data: CreateUserInput) => {
        setError(null);
        setSuccess(null);
        setSubmitting(true);

        try {
            const isPlatformRole = data.role === 'super_admin' || data.role === 'sub_super_admin';
            const response = await fetchWithRefresh('/api/super-admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...data,
                    hotelId: isPlatformRole ? null : data.hotelId,
                }),
            });

            const result = await response.json();
            if (!response.ok) {
                setError(result.error || 'ÙØ´Ù„ Ø¥Ù†Ø´Ø§Ø¡ Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…');
                return;
            }

            setSuccess('ØªÙ… Ø¥Ù†Ø´Ø§Ø¡ Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù… Ø¨Ù†Ø¬Ø§Ø­');
            await fetchUsers({ search, role: roleFilter, hotelId: hotelFilter });
            reset({ role: 'admin' });
        } catch {
            setError('ÙØ´Ù„ Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø®Ø§Ø¯Ù…');
        } finally {
            setSubmitting(false);
        }
    };

    const toggleUserStatus = async (user: UserItem) => {
        setError(null);
        setSuccess(null);
        try {
            const response = await fetchWithRefresh(`/api/super-admin/users/${user._id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: !user.isActive }),
            });
            const result = await response.json();
            if (!response.ok) {
                setError(result.error || 'ÙØ´Ù„ ØªØ­Ø¯ÙŠØ« Ø­Ø§Ù„Ø© Ø§Ù„Ø­Ø³Ø§Ø¨');
                return;
            }
            setUsers((prev) => prev.map((item) => (item._id === user._id ? { ...item, isActive: result.data.isActive } : item)));
            setSuccess('ØªÙ… ØªØ­Ø¯ÙŠØ« Ø§Ù„Ø­Ø§Ù„Ø©');
        } catch {
            setError('ÙØ´Ù„ Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø®Ø§Ø¯Ù…');
        }
    };

    const openEditUser = (user: UserItem) => {
        setEditForm({
            userId: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone || '',
            isActive: user.isActive,
        });
    };

    const saveUserEdit = async () => {
        if (!editForm) return;
        setSavingEdit(true);
        setError(null);
        setSuccess(null);
        try {
            const response = await fetchWithRefresh(`/api/super-admin/users/${editForm.userId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: editForm.name,
                    email: editForm.email,
                    phone: editForm.phone.trim() || null,
                    isActive: editForm.isActive,
                }),
            });
            const result = await response.json();
            if (!response.ok) {
                setError(result.error || 'ÙØ´Ù„ ØªØ­Ø¯ÙŠØ« Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…');
                return;
            }
            setSuccess('ØªÙ… ØªØ­Ø¯ÙŠØ« Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…');
            setEditForm(null);
            await fetchUsers({ search, role: roleFilter, hotelId: hotelFilter });
        } catch {
            setError('ÙØ´Ù„ Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø®Ø§Ø¯Ù…');
        } finally {
            setSavingEdit(false);
        }
    };

    const openDeleteUser = (user: UserItem) => {
        setError(null);
        setSuccess(null);

        if (!canDeleteUsers) {
            setError('Ø­Ø°Ù Ø§Ù„Ø­Ø³Ø§Ø¨Ø§Øª Ù…ØªØ§Ø­ Ù„Ù„Ø³ÙˆØ¨Ø± Ø£Ø¯Ù…Ù† Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠ ÙÙ‚Ø·');
            return;
        }

        if (user.role === 'super_admin') {
            setError('Ù„Ø§ ÙŠÙ…ÙƒÙ† Ø­Ø°Ù Ø­Ø³Ø§Ø¨ Ø§Ù„Ø³ÙˆØ¨Ø± Ø£Ø¯Ù…Ù† Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠ');
            return;
        }

        if (user._id === currentUserId) {
            setError('Ù„Ø§ ÙŠÙ…ÙƒÙ†Ùƒ Ø­Ø°Ù Ø­Ø³Ø§Ø¨Ùƒ Ø§Ù„Ø­Ø§Ù„ÙŠ');
            return;
        }

        setDeleteForm({
            userId: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
        });
        setDeleteConfirmEmail('');
    };

    const closeDeleteUser = () => {
        if (deletingUserId) return;
        setDeleteForm(null);
        setDeleteConfirmEmail('');
    };

    const confirmDeleteUser = async () => {
        if (!deleteForm) return;
        setError(null);
        setSuccess(null);

        if (deleteConfirmEmail.trim().toLowerCase() !== deleteForm.email.toLowerCase()) {
            setError('ÙŠØ¬Ø¨ Ø¥Ø¯Ø®Ø§Ù„ Ø§Ù„Ø¨Ø±ÙŠØ¯ Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ Ø§Ù„ØµØ­ÙŠØ­ Ù„ØªØ£ÙƒÙŠØ¯ Ø§Ù„Ø­Ø°Ù');
            return;
        }

        setDeletingUserId(deleteForm.userId);
        try {
            const response = await fetchWithRefresh(`/api/super-admin/users/${deleteForm.userId}`, {
                method: 'DELETE',
            });
            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                setError((result as { error?: string }).error || 'ÙØ´Ù„ Ø­Ø°Ù Ø§Ù„Ø­Ø³Ø§Ø¨');
                return;
            }

            setUsers((prev) => prev.filter((item) => item._id !== deleteForm.userId));
            if (editForm?.userId === deleteForm.userId) {
                setEditForm(null);
            }
            setSuccess(`ØªÙ… Ø­Ø°Ù Ø§Ù„Ø­Ø³Ø§Ø¨: ${deleteForm.name}`);
            setDeleteForm(null);
            setDeleteConfirmEmail('');
        } catch {
            setError('ÙØ´Ù„ Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø®Ø§Ø¯Ù…');
        } finally {
            setDeletingUserId(null);
        }
    };

    const clearFilters = () => {
        setSearchInput('');
        setRoleFilter('');
        setHotelFilter('');
    };

    const hotelOptions = useMemo(() => hotels.map((hotel) => ({ value: hotel._id, label: hotel.name })), [hotels]);
    const selectedRoleIsPlatform = selectedRole === 'super_admin' || selectedRole === 'sub_super_admin';

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…ÙŠÙ† ÙˆØ§Ù„ØµÙ„Ø§Ø­ÙŠØ§Øª</h1>
                <p className="mt-1 text-white/60">Ø¥Ø¯Ø§Ø±Ø© Ø­Ø³Ø§Ø¨Ø§Øª Ø§Ù„Ù…Ù†ØµØ© ÙˆØ§Ù„ÙÙ†Ø§Ø¯Ù‚ ÙˆÙÙ‚ Ù†Ø·Ø§Ù‚ Ø§Ù„ØµÙ„Ø§Ø­ÙŠØ§Øª Ø§Ù„Ù…Ø¹ØªÙ…Ø¯ØŒ Ù…Ø¹ Ø­Ø°Ù Ø¢Ù…Ù† Ù„Ù„Ø­Ø³Ø§Ø¨Ø§Øª.</p>
            </div>

            {(error || success) && (
                <div className="space-y-2">
                    {error && <div className="p-3 bg-danger-500/10 border border-danger-500/20 rounded-xl text-danger-600 text-sm">{error}</div>}
                    {success && <div className="p-3 bg-success-500/10 border border-success-500/20 rounded-xl text-success-500 text-sm">{success}</div>}
                </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="stat-card">
                    <p className="text-xs text-white/50">Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„Ø­Ø³Ø§Ø¨Ø§Øª</p>
                    <p className="text-lg font-semibold text-primary-300">{userStats.total}</p>
                </div>
                <div className="stat-card">
                    <p className="text-xs text-white/50">Ø­Ø³Ø§Ø¨Ø§Øª Ù†Ø´Ø·Ø©</p>
                    <p className="text-lg font-semibold text-success-500">{userStats.active}</p>
                </div>
                <div className="stat-card">
                    <p className="text-xs text-white/50">Ø­Ø³Ø§Ø¨Ø§Øª ØºÙŠØ± Ù†Ø´Ø·Ø©</p>
                    <p className="text-lg font-semibold text-danger-500">{userStats.inactive}</p>
                </div>
                <div className="stat-card">
                    <p className="text-xs text-white/50">Ø­Ø³Ø§Ø¨Ø§Øª Ø§Ù„Ù…Ù†ØµØ©</p>
                    <p className="text-lg font-semibold text-accent-300">{userStats.platform}</p>
                </div>
            </div>

            <div className="card p-5 space-y-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <UserCog className="w-5 h-5 text-primary-300" />
                    Ø¥Ù†Ø´Ø§Ø¡ Ù…Ø³ØªØ®Ø¯Ù…
                </h2>

                <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input {...register('name')} className="input-compact w-full" placeholder="Ø§Ù„Ø§Ø³Ù…" />
                    <input {...register('email')} type="email" className="input-compact w-full" placeholder="Ø§Ù„Ø¨Ø±ÙŠØ¯ Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ" dir="ltr" />
                    <input {...register('password')} type="password" className="input-compact w-full" placeholder="ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ±" dir="ltr" />
                    <select {...register('role')} className="input-compact w-full">
                        {createRoles.map((value) => (
                            <option key={value} value={value}>{roleLabels[value] || value}</option>
                        ))}
                    </select>
                    <div className="md:col-span-2 relative">
                        <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                        <select {...register('hotelId')} className="input-compact w-full pr-9" disabled={selectedRoleIsPlatform}>
                            <option value="">Ø§Ø®ØªØ± Ø§Ù„ÙÙ†Ø¯Ù‚</option>
                            {hotelOptions.map((hotel) => (
                                <option key={hotel.value} value={hotel.value}>{hotel.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="md:col-span-2 flex justify-end">
                        <button type="submit" className="btn-primary text-sm" disabled={submitting}>
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" />Ø¥Ù†Ø´Ø§Ø¡ Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…</>}
                        </button>
                    </div>
                </form>

                {(errors.name || errors.email || errors.password || errors.role || errors.hotelId) && (
                    <p className="text-xs text-danger-500">ÙŠØ±Ø¬Ù‰ Ù…Ø±Ø§Ø¬Ø¹Ø© Ø§Ù„Ø­Ù‚ÙˆÙ„ Ù‚Ø¨Ù„ Ø§Ù„Ø¥Ø±Ø³Ø§Ù„.</p>
                )}
            </div>`n            <div className="card p-5 space-y-4">
                <div className="flex flex-col lg:flex-row gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="input-compact w-full pr-9"
                            placeholder="Ø¨Ø­Ø« Ø¨Ø§Ù„Ø§Ø³Ù… Ø£Ùˆ Ø§Ù„Ø¨Ø±ÙŠØ¯ Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ"
                        />
                    </div>
                    <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className="input-compact min-w-[180px]"
                    >
                        <option value="">ÙƒÙ„ Ø§Ù„Ø£Ø¯ÙˆØ§Ø±</option>
                        {Object.entries(roleLabels).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                        ))}
                    </select>
                    <select
                        value={hotelFilter}
                        onChange={(e) => setHotelFilter(e.target.value)}
                        className="input-compact min-w-[180px]"
                    >
                        <option value="">ÙƒÙ„ Ø§Ù„ÙÙ†Ø§Ø¯Ù‚</option>
                        {hotelOptions.map((hotel) => (
                            <option key={hotel.value} value={hotel.value}>{hotel.label}</option>
                        ))}
                    </select>
                    <button type="button" onClick={clearFilters} className="btn-secondary text-sm">
                        Ù…Ø³Ø­ Ø§Ù„ÙÙ„Ø§ØªØ±
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setLoading(true);
                            fetchUsers({ search, role: roleFilter, hotelId: hotelFilter });
                        }}
                        className="btn-secondary text-sm"
                    >
                        <RefreshCcw className="w-4 h-4" />
                        ØªØ­Ø¯ÙŠØ«
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center py-8"><div className="spinner w-10 h-10" /></div>
                ) : users.length === 0 ? (
                    <p className="text-white/60 text-center py-8">Ù„Ø§ ÙŠÙˆØ¬Ø¯ Ù…Ø³ØªØ®Ø¯Ù…ÙˆÙ† Ø­Ø§Ù„ÙŠÙ‹Ø§.</p>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Ø§Ù„Ø§Ø³Ù…</th>
                                    <th>Ø§Ù„Ø¨Ø±ÙŠØ¯</th>
                                    <th>Ø§Ù„Ø¯ÙˆØ±</th>
                                    <th>Ø§Ù„ÙÙ†Ø¯Ù‚</th>
                                    <th>ØªÙ… Ø§Ù„Ø¥Ù†Ø´Ø§Ø¡ Ø¨ÙˆØ§Ø³Ø·Ø©</th>
                                    <th>Ø§Ù„Ø­Ø§Ù„Ø©</th>
                                    <th>Ø¥Ø¬Ø±Ø§Ø¡Ø§Øª</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((user) => {
                                    const isSelf = user._id === currentUserId;
                                    const isMainSuper = user.role === 'super_admin';
                                    const deleteDisabled = !canDeleteUsers || isSelf || isMainSuper || Boolean(deletingUserId);

                                    return (
                                        <tr key={user._id}>
                                            <td className="font-medium text-white">
                                                <div className="flex items-center gap-2">
                                                    <span>{user.name}</span>
                                                    {isSelf && <span className="badge-primary text-[10px]">Ø­Ø³Ø§Ø¨Ùƒ</span>}
                                                </div>
                                            </td>
                                            <td className="text-white/60" dir="ltr">{user.email}</td>
                                            <td className="text-white/70">{roleLabels[user.role] || user.role}</td>
                                            <td className="text-white/60">{user.hotel?.name || '-'}</td>
                                            <td className="text-white/60">{user.createdBy?.name || '-'}</td>
                                            <td>
                                                {user.isActive ? (
                                                    <span className="badge-success inline-flex items-center gap-1"><CheckCircle className="w-3 h-3" />Ù†Ø´Ø·</span>
                                                ) : (
                                                    <span className="badge-danger inline-flex items-center gap-1"><XCircle className="w-3 h-3" />ØºÙŠØ± Ù†Ø´Ø·</span>
                                                )}
                                            </td>
                                            <td>
                                                <div className="flex flex-wrap gap-1">
                                                    <button onClick={() => toggleUserStatus(user)} className="btn-secondary text-xs" disabled={isSelf && user.isActive}>
                                                        {user.isActive ? 'ØªØ¹Ø·ÙŠÙ„' : 'ØªÙØ¹ÙŠÙ„'}
                                                    </button>
                                                    <button onClick={() => openEditUser(user)} className="btn-secondary text-xs">
                                                        <Pencil className="w-3.5 h-3.5" />
                                                        ØªØ¹Ø¯ÙŠÙ„
                                                    </button>
                                                    {canDeleteUsers && (
                                                        <button
                                                            onClick={() => openDeleteUser(user)}
                                                            className="btn-danger text-xs"
                                                            disabled={deleteDisabled}
                                                            title={isSelf ? 'Ù„Ø§ ÙŠÙ…ÙƒÙ†Ùƒ Ø­Ø°Ù Ø­Ø³Ø§Ø¨Ùƒ' : isMainSuper ? 'Ù„Ø§ ÙŠÙ…ÙƒÙ† Ø­Ø°Ù Ø§Ù„Ø³ÙˆØ¨Ø± Ø£Ø¯Ù…Ù† Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠ' : 'Ø­Ø°Ù Ø§Ù„Ø­Ø³Ø§Ø¨'}
                                                        >
                                                            {deletingUserId === user._id ? (
                                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                            ) : (
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            )}
                                                            Ø­Ø°Ù
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {editForm && (
                <div className="card p-5 space-y-3">
                    <h3 className="text-base font-semibold text-white">ØªØ¹Ø¯ÙŠÙ„ Ø­Ø³Ø§Ø¨ Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input value={editForm.name} onChange={(e) => setEditForm((prev) => prev ? { ...prev, name: e.target.value } : prev)} className="input-compact w-full" placeholder="Ø§Ù„Ø§Ø³Ù…" />
                        <input value={editForm.email} onChange={(e) => setEditForm((prev) => prev ? { ...prev, email: e.target.value } : prev)} className="input-compact w-full" placeholder="Ø§Ù„Ø¨Ø±ÙŠØ¯ Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ" dir="ltr" />
                        <input value={editForm.phone} onChange={(e) => setEditForm((prev) => prev ? { ...prev, phone: e.target.value } : prev)} className="input-compact w-full" placeholder="Ø±Ù‚Ù… Ø§Ù„Ù‡Ø§ØªÙ" dir="ltr" />
                        <label className="surface-tile flex items-center justify-between text-sm">
                            ØªÙØ¹ÙŠÙ„ Ø§Ù„Ø­Ø³Ø§Ø¨
                            <input type="checkbox" checked={editForm.isActive} onChange={(e) => setEditForm((prev) => prev ? { ...prev, isActive: e.target.checked } : prev)} />
                        </label>
                    </div>
                    <div className="flex justify-end gap-2">
                        <button className="btn-secondary text-sm" onClick={() => setEditForm(null)}>Ø¥ØºÙ„Ø§Ù‚</button>
                        <button className="btn-primary text-sm" onClick={saveUserEdit} disabled={savingEdit}>
                            {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ø­ÙØ¸ Ø§Ù„ØªØ¹Ø¯ÙŠÙ„Ø§Øª'}
                        </button>
                    </div>
                </div>
            )}

            {deleteForm && (
                <div className="card p-5 space-y-4 border border-danger-500/30">
                    <h3 className="text-base font-semibold text-white flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-danger-500" />
                        ØªØ£ÙƒÙŠØ¯ Ø­Ø°Ù Ø§Ù„Ø­Ø³Ø§Ø¨
                    </h3>
                    <p className="text-sm text-white/70">
                        Ø³ÙŠØªÙ… Ø­Ø°Ù Ø§Ù„Ø­Ø³Ø§Ø¨ <span className="text-white font-medium">{deleteForm.name}</span> Ù†Ù‡Ø§Ø¦ÙŠÙ‹Ø§.
                        Ø§ÙƒØªØ¨ Ø§Ù„Ø¨Ø±ÙŠØ¯ Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ Ù„ØªØ£ÙƒÙŠØ¯ Ø§Ù„Ø¹Ù…Ù„ÙŠØ©:
                    </p>
                    <div className="surface-tile">
                        <p className="text-xs text-white/50 mb-1">Ø§Ù„Ø¨Ø±ÙŠØ¯ Ø§Ù„Ù…Ø·Ù„ÙˆØ¨ Ù„Ù„ØªØ£ÙƒÙŠØ¯</p>
                        <p className="text-sm text-white font-medium" dir="ltr">{deleteForm.email}</p>
                    </div>
                    <input
                        value={deleteConfirmEmail}
                        onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                        className="input-compact w-full"
                        placeholder="Ø£Ø¯Ø®Ù„ Ø§Ù„Ø¨Ø±ÙŠØ¯ Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ Ù„Ù„ØªØ£ÙƒÙŠØ¯"
                        dir="ltr"
                    />
                    <div className="flex justify-end gap-2">
                        <button className="btn-secondary text-sm" onClick={closeDeleteUser} disabled={Boolean(deletingUserId)}>
                            Ø¥Ù„ØºØ§Ø¡
                        </button>
                        <button className="btn-danger text-sm" onClick={confirmDeleteUser} disabled={Boolean(deletingUserId)}>
                            {deletingUserId ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Trash2 className="w-4 h-4" />ØªØ£ÙƒÙŠØ¯ Ø§Ù„Ø­Ø°Ù</>}
                        </button>
                    </div>
                </div>
            )}

            {!canDeleteUsers && (
                <div className="surface-tile text-xs text-white/60 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Ø­Ø°Ù Ø§Ù„Ø­Ø³Ø§Ø¨Ø§Øª Ù…ØªØ§Ø­ ÙÙ‚Ø· Ù„Ù„Ø³ÙˆØ¨Ø± Ø£Ø¯Ù…Ù† Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠ.
                </div>
            )}
        </div>
    );
}

