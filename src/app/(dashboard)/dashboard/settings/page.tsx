'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    Building2,
    Globe,
    Clock,
    Palette,
    Bell,
    Shield,
    Save,
    Loader2,
} from 'lucide-react';
import { useHotelSettings, HotelSettings } from '@/app/(dashboard)/layout';
import { fetchWithRefresh } from '@/lib/fetchWithRefresh';
import { normalizeLanguage, t } from '@/lib/i18n';

export default function SettingsPage() {
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('general');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const { setSettings: setLayoutSettings, setHotelProfile } = useHotelSettings();

    const defaultSettings = useMemo(() => ({
        hotelName: 'فندق ربيع الأحلام',
        email: 'info@hotel.com',
        phone: '+966 50 123 4567',
        currency: 'SAR',
        timezone: 'Asia/Riyadh',
        language: 'ar',
        checkInTime: '14:00',
        checkOutTime: '12:00',
        theme: 'dark' as 'light' | 'dark' | 'system',
        taxRate: 15,
        logo: '',
        notifications: {
            newBooking: true,
            cancelledBooking: true,
            paymentReceived: true,
            dailyReport: true,
        },
    }), []);

    const [settings, setSettings] = useState(defaultSettings);
    const [initialSettings, setInitialSettings] = useState(defaultSettings);
    const lang = normalizeLanguage(settings.language);

    const toLayoutSettings = (data: typeof defaultSettings): HotelSettings => ({
        currency: data.currency,
        timezone: data.timezone,
        language: normalizeLanguage(data.language),
        checkInTime: data.checkInTime,
        checkOutTime: data.checkOutTime,
        taxRate: Number(data.taxRate) || 0,
        theme: data.theme,
        notifications: data.notifications,
    });

    const normalizeSettings = (hotel?: any) => {
        const hotelSettings = hotel?.settings || {};
        return {
            hotelName: hotel?.name || defaultSettings.hotelName,
            email: hotel?.email || defaultSettings.email,
            phone: hotel?.phone || defaultSettings.phone,
            logo: hotel?.logo || defaultSettings.logo,
            currency: hotelSettings.currency || defaultSettings.currency,
            timezone: hotelSettings.timezone || defaultSettings.timezone,
            language: normalizeLanguage(hotelSettings.language || defaultSettings.language),
            checkInTime: hotelSettings.checkInTime || defaultSettings.checkInTime,
            checkOutTime: hotelSettings.checkOutTime || defaultSettings.checkOutTime,
            taxRate: typeof hotelSettings.taxRate === 'number' ? hotelSettings.taxRate : defaultSettings.taxRate,
            theme: hotelSettings.theme || defaultSettings.theme,
            notifications: {
                ...defaultSettings.notifications,
                ...(hotelSettings.notifications || {}),
            },
        };
    };

    const handleLogoChange = (file: File | null) => {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setError(t(lang, 'يرجى اختيار ملف صورة صالح', 'Please select a valid image file'));
            return;
        }
        if (file.size > 1024 * 1024) {
            setError(t(lang, 'حجم الشعار يجب أن يكون أقل من 1MB', 'Logo size must be less than 1MB'));
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const result = typeof reader.result === 'string' ? reader.result : '';
            setSettings((prev) => ({ ...prev, logo: result }));
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        setError(null);
        setSuccess(null);
        setIsSaving(true);

        try {
            const response = await fetchWithRefresh('/api/auth/me', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    hotelName: settings.hotelName,
                    email: settings.email,
                    phone: settings.phone,
                    logo: settings.logo || '',
                    settings: {
                        currency: settings.currency,
                        timezone: settings.timezone,
                        language: settings.language,
                        checkInTime: settings.checkInTime,
                        checkOutTime: settings.checkOutTime,
                        taxRate: Number(settings.taxRate) || 0,
                        theme: settings.theme,
                        notifications: settings.notifications,
                    },
                }),
            });

            const result = await response.json();
            if (!response.ok) {
                setError(result.error || t(lang, 'حدث خطأ أثناء حفظ الإعدادات', 'Failed to save settings'));
                return;
            }

            const normalized = normalizeSettings(result.data);
            setSettings(normalized);
            setInitialSettings(normalized);
            setLayoutSettings(toLayoutSettings(normalized));
            setHotelProfile({
                name: result.data?.name,
                email: result.data?.email,
                phone: result.data?.phone,
                logo: result.data?.logo,
                address: result.data?.address,
            });
            setSuccess(t(lang, 'تم حفظ الإعدادات بنجاح', 'Settings saved successfully'));
        } catch (err) {
            setError(t(lang, 'حدث خطأ في الاتصال بالخادم', 'Network error while contacting the server'));
        } finally {
            setIsSaving(false);
        }
    };

    useEffect(() => {
        const loadSettings = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const response = await fetchWithRefresh('/api/auth/me');
                const data = await response.json();

                if (!response.ok) {
                    setError(data.error || t(lang, 'تعذر جلب الإعدادات', 'Failed to load settings'));
                    return;
                }

                const normalized = normalizeSettings(data.user?.hotel);
                setSettings(normalized);
                setInitialSettings(normalized);
                setLayoutSettings(toLayoutSettings(normalized));
                setHotelProfile({
                    name: data.user?.hotel?.name,
                    email: data.user?.hotel?.email,
                    phone: data.user?.hotel?.phone,
                    logo: data.user?.hotel?.logo,
                    address: data.user?.hotel?.address,
                });
            } catch (err) {
                setError(t(lang, 'حدث خطأ في الاتصال بالخادم', 'Network error while contacting the server'));
            } finally {
                setIsLoading(false);
            }
        };

        loadSettings();
    }, []);

    const hasChanges = useMemo(
        () => JSON.stringify(settings) !== JSON.stringify(initialSettings),
        [settings, initialSettings]
    );

    const tabs = [
        { id: 'general', label: { ar: 'عام', en: 'General' }, icon: Building2 },
        { id: 'localization', label: { ar: 'التوطين', en: 'Localization' }, icon: Globe },
        { id: 'operations', label: { ar: 'العمليات', en: 'Operations' }, icon: Clock },
        { id: 'appearance', label: { ar: 'المظهر', en: 'Appearance' }, icon: Palette },
        { id: 'notifications', label: { ar: 'الإشعارات', en: 'Notifications' }, icon: Bell },
        { id: 'security', label: { ar: 'الأمان', en: 'Security' }, icon: Shield },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white">
                    {t(lang, 'الإعدادات', 'Settings')}
                </h1>
                <p className="mt-1 text-white/60">
                    {t(lang, 'إدارة إعدادات الفندق والنظام', 'Manage hotel and system settings')}
                </p>
            </div>

            {error && (
                <div className="p-4 bg-danger-500/10 border border-danger-500/20 rounded-xl text-danger-600 text-sm">
                    {error}
                </div>
            )}

            {success && (
                <div className="p-4 bg-success-500/10 border border-success-500/20 rounded-xl text-success-500 text-sm">
                    {success}
                </div>
            )}

            <div className="flex flex-col lg:flex-row gap-6">
                {/* Tabs */}
                <div className="lg:w-64 shrink-0">
                    <nav className="card p-2 space-y-1">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all border ${activeTab === tab.id
                                        ? 'bg-primary-500/15 text-white border-primary-500/40'
                                        : 'text-white/60 border-transparent hover:bg-white/5 hover:text-white'
                                    }`}
                            >
                                <tab.icon className="w-5 h-5" />
                                <span className="font-medium">{tab.label[lang]}</span>
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Content */}
                <div className="flex-1">
                    <div className="card p-6">
                        {isLoading ? (
                            <div className="flex justify-center py-12">
                                <div className="spinner w-10 h-10" />
                            </div>
                        ) : (
                            <>
                                {/* General Settings */}
                                {activeTab === 'general' && (
                                    <div className="space-y-6">
                                        <h2 className="text-lg font-semibold text-white mb-6">
                                            {t(lang, 'معلومات الفندق', 'Hotel information')}
                                        </h2>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-sm font-medium text-white/70 mb-2">
                                                    {t(lang, 'اسم الفندق', 'Hotel name')}
                                                </label>
                                                <input
                                                    type="text"
                                                    value={settings.hotelName}
                                                    onChange={(e) => setSettings({ ...settings, hotelName: e.target.value })}
                                                    className="input"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-white/70 mb-2">
                                                    {t(lang, 'البريد الإلكتروني', 'Email')}
                                                </label>
                                                <input
                                                    type="email"
                                                    value={settings.email}
                                                    onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                                                    className="input"
                                                    dir="ltr"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-white/70 mb-2">
                                                    {t(lang, 'رقم الهاتف', 'Phone')}
                                                </label>
                                                <input
                                                    type="tel"
                                                    value={settings.phone}
                                                    onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                                                    className="input"
                                                    dir="ltr"
                                                />
                                            </div>

                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-medium text-white/70 mb-2">
                                                    {t(lang, 'شعار الفندق', 'Hotel logo')}
                                                </label>
                                                <div className="flex flex-col md:flex-row md:items-center gap-4">
                                                    <div className="flex items-center gap-3">
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            onChange={(e) => handleLogoChange(e.target.files?.[0] || null)}
                                                            className="input"
                                                        />
                                                        {settings.logo && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setSettings({ ...settings, logo: '' })}
                                                                className="btn-secondary text-sm"
                                                            >
                                                                {t(lang, 'إزالة الشعار', 'Remove logo')}
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        {settings.logo ? (
                                                            <img
                                                                src={settings.logo}
                                                                alt={t(lang, 'شعار الفندق', 'Hotel logo')}
                                                                className="w-20 h-20 rounded-xl object-contain border border-white/10 bg-white/5 p-2"
                                                            />
                                                        ) : (
                                                            <div className="w-20 h-20 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-xs text-white/40">
                                                                {t(lang, 'بدون شعار', 'No logo')}
                                                            </div>
                                                        )}
                                                        <p className="text-xs text-white/50">
                                                            {t(
                                                                lang,
                                                                'يفضل رفع صورة PNG بخلفية شفافة بحجم أقل من 1MB.',
                                                                'Prefer uploading a transparent PNG under 1MB.'
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Localization Settings */}
                                {activeTab === 'localization' && (
                                    <div className="space-y-6">
                                        <h2 className="text-lg font-semibold text-white mb-6">
                                            {t(lang, 'إعدادات التوطين', 'Localization settings')}
                                        </h2>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-sm font-medium text-white/70 mb-2">
                                                    {t(lang, 'العملة', 'Currency')}
                                                </label>
                                                <select
                                                    value={settings.currency}
                                                    onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                                                    className="input"
                                                >
                                                    <option value="SAR">{t(lang, 'ريال سعودي (SAR)', 'Saudi Riyal (SAR)')}</option>
                                                    <option value="AED">{t(lang, 'درهم إماراتي (AED)', 'UAE Dirham (AED)')}</option>
                                                    <option value="USD">{t(lang, 'دولار أمريكي (USD)', 'US Dollar (USD)')}</option>
                                                    <option value="EUR">{t(lang, 'يورو (EUR)', 'Euro (EUR)')}</option>
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-white/70 mb-2">
                                                    {t(lang, 'المنطقة الزمنية', 'Timezone')}
                                                </label>
                                                <select
                                                    value={settings.timezone}
                                                    onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                                                    className="input"
                                                >
                                                    <option value="Asia/Riyadh">{t(lang, 'الرياض (GMT+3)', 'Riyadh (GMT+3)')}</option>
                                                    <option value="Asia/Dubai">{t(lang, 'دبي (GMT+4)', 'Dubai (GMT+4)')}</option>
                                                    <option value="Africa/Cairo">{t(lang, 'القاهرة (GMT+2)', 'Cairo (GMT+2)')}</option>
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-white/70 mb-2">
                                                    {t(lang, 'اللغة', 'Language')}
                                                </label>
                                                <select
                                                    value={settings.language}
                                                    onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                                                    className="input"
                                                >
                                                    <option value="ar">{t(lang, 'العربية', 'Arabic')}</option>
                                                    <option value="en">{t(lang, 'الإنجليزية', 'English')}</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Operations Settings */}
                                {activeTab === 'operations' && (
                                    <div className="space-y-6">
                                        <h2 className="text-lg font-semibold text-white mb-6">
                                            {t(lang, 'إعدادات العمليات', 'Operations settings')}
                                        </h2>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-sm font-medium text-white/70 mb-2">
                                                    {t(lang, 'وقت تسجيل الوصول', 'Check-in time')}
                                                </label>
                                                <input
                                                    type="time"
                                                    value={settings.checkInTime}
                                                    onChange={(e) => setSettings({ ...settings, checkInTime: e.target.value })}
                                                    className="input"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-white/70 mb-2">
                                                    {t(lang, 'وقت تسجيل المغادرة', 'Check-out time')}
                                                </label>
                                                <input
                                                    type="time"
                                                    value={settings.checkOutTime}
                                                    onChange={(e) => setSettings({ ...settings, checkOutTime: e.target.value })}
                                                    className="input"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-white/70 mb-2">
                                                    {t(lang, 'نسبة الضريبة (%)', 'Tax rate (%)')}
                                                </label>
                                                <input
                                                    type="number"
                                                    value={settings.taxRate}
                                                    onChange={(e) => setSettings({ ...settings, taxRate: Number(e.target.value) })}
                                                    className="input"
                                                    min="0"
                                                    max="30"
                                                    step="0.5"
                                                />
                                                <p className="mt-1 text-xs text-white/40">
                                                    {t(lang, 'مثال: 15 تعني 15% من قيمة الحجز.', 'Example: 15 means 15% of the booking total.')}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Notifications Settings */}
                                {activeTab === 'notifications' && (
                                    <div className="space-y-6">
                                        <h2 className="text-lg font-semibold text-white mb-6">
                                            {t(lang, 'إعدادات الإشعارات', 'Notification settings')}
                                        </h2>

                                        <div className="space-y-4">
                                            {[
                                                { key: 'newBooking', label: { ar: 'حجز جديد', en: 'New booking' } },
                                                { key: 'cancelledBooking', label: { ar: 'إلغاء حجز', en: 'Booking cancelled' } },
                                                { key: 'paymentReceived', label: { ar: 'استلام دفعة', en: 'Payment received' } },
                                                { key: 'dailyReport', label: { ar: 'التقرير اليومي', en: 'Daily report' } },
                                            ].map((item) => (
                                                <label
                                                    key={item.key}
                                                    className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 cursor-pointer"
                                                >
                                                    <span className="font-medium text-white">
                                                        {item.label[lang]}
                                                    </span>
                                                    <input
                                                        type="checkbox"
                                                        checked={settings.notifications[item.key as keyof typeof settings.notifications]}
                                                        onChange={(e) =>
                                                            setSettings({
                                                                ...settings,
                                                                notifications: {
                                                                    ...settings.notifications,
                                                                    [item.key]: e.target.checked,
                                                                },
                                                            })
                                                        }
                                                        className="w-5 h-5 rounded border-white/20 bg-transparent text-primary-400 focus:ring-primary-500"
                                                    />
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Appearance */}
                                {activeTab === 'appearance' && (
                                    <div className="space-y-6">
                                        <h2 className="text-lg font-semibold text-white mb-6">
                                            {t(lang, 'المظهر', 'Appearance')}
                                        </h2>
                                        <div className="flex gap-4">
                                            {['light', 'dark', 'system'].map((theme) => (
                                                <button
                                                    key={theme}
                                                    onClick={() => setSettings({ ...settings, theme: theme as 'light' | 'dark' | 'system' })}
                                                    className={`flex-1 p-4 rounded-xl border-2 transition-all ${settings.theme === theme
                                                            ? 'border-primary-500 bg-primary-500/15 text-white'
                                                            : 'border-white/10 text-white/60 hover:text-white'
                                                        }`}
                                                >
                                                    <span className="font-medium">
                                                        {theme === 'light'
                                                            ? t(lang, 'فاتح', 'Light')
                                                            : theme === 'dark'
                                                                ? t(lang, 'داكن', 'Dark')
                                                                : t(lang, 'تلقائي', 'System')}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Security */}
                                {activeTab === 'security' && (
                                    <div className="space-y-6">
                                        <h2 className="text-lg font-semibold text-white mb-6">
                                            {t(lang, 'الأمان', 'Security')}
                                        </h2>
                                        <p className="text-white/60">
                                            {t(lang, 'إعدادات الأمان وكلمات المرور', 'Security and password settings')}
                                        </p>
                                        <button className="btn-secondary">
                                            {t(lang, 'تغيير كلمة المرور', 'Change password')}
                                        </button>
                                    </div>
                                )}

                                {/* Save Button */}
                                <div className="mt-8 pt-6 border-t border-white/5 flex justify-end">
                                    <button
                                        onClick={handleSave}
                                        disabled={isSaving || isLoading || !hasChanges}
                                        className="btn-primary"
                                    >
                                        {isSaving ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : (
                                            <>
                                                <Save className="w-5 h-5" />
                                                <span>{t(lang, 'حفظ التغييرات', 'Save changes')}</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
