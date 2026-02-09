'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
    ArrowRight,
    Save,
    Loader2,
    BedDouble,
    DollarSign,
    Hash,
    Building2,
} from 'lucide-react';
import { useHotelSettings } from '@/app/(dashboard)/layout';
import { createRoomSchema, CreateRoomInput } from '@/lib/validations';
import { fetchWithRefresh } from '@/lib/fetchWithRefresh';
import { normalizeLanguage, t } from '@/lib/i18n';

const roomTypes = [
    { value: 'single', label: { ar: 'مفردة', en: 'Single' }, description: { ar: 'غرفة بسرير مفرد', en: 'Single bed room' } },
    { value: 'double', label: { ar: 'مزدوجة', en: 'Double' }, description: { ar: 'غرفة بسرير مزدوج', en: 'Double bed room' } },
    { value: 'twin', label: { ar: 'توأم', en: 'Twin' }, description: { ar: 'غرفة بسريرين منفصلين', en: 'Two separate beds' } },
    { value: 'suite', label: { ar: 'جناح', en: 'Suite' }, description: { ar: 'جناح فاخر مع غرفة معيشة', en: 'Premium suite with living area' } },
    { value: 'deluxe', label: { ar: 'فاخرة', en: 'Deluxe' }, description: { ar: 'غرفة فاخرة مع إطلالة', en: 'Deluxe room with a view' } },
    { value: 'presidential', label: { ar: 'رئاسية', en: 'Presidential' }, description: { ar: 'الجناح الرئاسي', en: 'Presidential suite' } },
];

const amenitiesList = [
    { value: 'تكييف', label: { ar: 'تكييف', en: 'AC' } },
    { value: 'واي فاي', label: { ar: 'واي فاي', en: 'Wi-Fi' } },
    { value: 'تلفزيون', label: { ar: 'تلفزيون', en: 'TV' } },
    { value: 'ميني بار', label: { ar: 'ميني بار', en: 'Mini bar' } },
    { value: 'خزنة', label: { ar: 'خزنة', en: 'Safe' } },
    { value: 'بلكونة', label: { ar: 'بلكونة', en: 'Balcony' } },
    { value: 'جاكوزي', label: { ar: 'جاكوزي', en: 'Jacuzzi' } },
    { value: 'مطبخ صغير', label: { ar: 'مطبخ صغير', en: 'Kitchenette' } },
    { value: 'غرفة معيشة', label: { ar: 'غرفة معيشة', en: 'Living room' } },
    { value: 'إطلالة بحرية', label: { ar: 'إطلالة بحرية', en: 'Sea view' } },
    { value: 'إطلالة حديقة', label: { ar: 'إطلالة حديقة', en: 'Garden view' } },
];

export default function NewRoomPage() {
    const router = useRouter();
    const { settings: hotelSettings } = useHotelSettings();
    const lang = normalizeLanguage(hotelSettings?.language);
    const [error, setError] = useState<string | null>(null);
    const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<CreateRoomInput>({
        resolver: zodResolver(createRoomSchema),
        defaultValues: {
            capacity: { adults: 2, children: 0 },
        },
    });

    const toggleAmenity = (amenity: string) => {
        setSelectedAmenities((prev) =>
            prev.includes(amenity)
                ? prev.filter((a) => a !== amenity)
                : [...prev, amenity]
        );
    };

    const onSubmit = async (data: CreateRoomInput) => {
        setError(null);

        try {
            const response = await fetchWithRefresh('/api/rooms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...data,
                    amenities: selectedAmenities,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                setError(result.error || t(lang, 'حدث خطأ أثناء إنشاء الغرفة', 'Failed to create the room'));
                return;
            }

            router.push('/dashboard/rooms');

        } catch (err) {
            setError(t(lang, 'حدث خطأ في الاتصال بالخادم', 'Network error while contacting the server'));
        }
    };

    return (
        <div className="max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-lg hover:bg-white/10"
                >
                    <ArrowRight className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-white">
                        {t(lang, 'إضافة غرفة جديدة', 'Add New Room')}
                    </h1>
                    <p className="mt-1 text-white/60">
                        {t(lang, 'أدخل بيانات الغرفة الجديدة', 'Enter the room details')}
                    </p>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="mb-6 p-4 bg-danger-500/10 border border-danger-500/20 rounded-xl text-danger-500 text-sm animate-slide-down">
                    {error}
                </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="card p-6 space-y-6">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <BedDouble className="w-5 h-5 text-primary-300" />
                        {t(lang, 'معلومات الغرفة', 'Room Information')}
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Room Number */}
                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">
                                {t(lang, 'رقم الغرفة *', 'Room number *')}
                            </label>
                            <div className="relative">
                                <Hash className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                                <input
                                    {...register('roomNumber')}
                                    className="input pr-10"
                                    placeholder="101"
                                />
                            </div>
                            {errors.roomNumber && (
                                <p className="mt-1 text-sm text-danger-500">{errors.roomNumber.message}</p>
                            )}
                        </div>

                        {/* Floor */}
                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">
                                {t(lang, 'الطابق *', 'Floor *')}
                            </label>
                            <div className="relative">
                                <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                                <input
                                    type="number"
                                    {...register('floor', { valueAsNumber: true })}
                                    className="input pr-10"
                                    placeholder="1"
                                    min="0"
                                />
                            </div>
                            {errors.floor && (
                                <p className="mt-1 text-sm text-danger-500">{errors.floor.message}</p>
                            )}
                        </div>

                        {/* Price */}
                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">
                                {t(
                                    lang,
                                    `السعر لليلة (${hotelSettings?.currency || 'SAR'}) *`,
                                    `Price per night (${hotelSettings?.currency || 'SAR'}) *`
                                )}
                            </label>
                            <div className="relative">
                                <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                                <input
                                    type="number"
                                    {...register('pricePerNight', { valueAsNumber: true })}
                                    className="input pr-10"
                                    placeholder="500"
                                    min="0"
                                />
                            </div>
                            {errors.pricePerNight && (
                                <p className="mt-1 text-sm text-danger-500">{errors.pricePerNight.message}</p>
                            )}
                        </div>

                        {/* Capacity */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-white/70 mb-2">
                                    {t(lang, 'البالغين', 'Adults')}
                                </label>
                                <input
                                    type="number"
                                    {...register('capacity.adults', { valueAsNumber: true })}
                                    className="input"
                                    min="1"
                                    defaultValue={2}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-white/70 mb-2">
                                    {t(lang, 'الأطفال', 'Children')}
                                </label>
                                <input
                                    type="number"
                                    {...register('capacity.children', { valueAsNumber: true })}
                                    className="input"
                                    min="0"
                                    defaultValue={0}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Room Type */}
                    <div>
                        <label className="block text-sm font-medium text-white/70 mb-3">
                            {t(lang, 'نوع الغرفة *', 'Room type *')}
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {roomTypes.map((type) => (
                                <label
                                    key={type.value}
                                    className="relative flex cursor-pointer rounded-xl border border-white/10 p-4 focus:outline-none hover:border-primary-500/60 transition-colors"
                                >
                                    <input
                                        type="radio"
                                        {...register('type')}
                                        value={type.value}
                                        className="sr-only"
                                    />
                                    <div className="flex flex-col">
                                        <span className="font-medium text-white">
                                            {type.label[lang]}
                                        </span>
                                        <span className="text-xs text-white/50 mt-1">
                                            {type.description[lang]}
                                        </span>
                                    </div>
                                </label>
                            ))}
                        </div>
                        {errors.type && (
                            <p className="mt-1 text-sm text-danger-500">{errors.type.message}</p>
                        )}
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-white/70 mb-2">
                            {t(lang, 'الوصف', 'Description')}
                        </label>
                        <textarea
                            {...register('description')}
                            className="input min-h-[100px]"
                            placeholder={t(lang, 'وصف مختصر للغرفة...', 'Short room description...')}
                        />
                    </div>
                </div>

                {/* Amenities */}
                <div className="card p-6">
                    <h2 className="text-lg font-semibold text-white mb-4">
                        {t(lang, 'المرافق والخدمات', 'Amenities')}
                    </h2>
                    <div className="flex flex-wrap gap-2">
                        {amenitiesList.map((amenity) => (
                            <button
                                key={amenity.value}
                                type="button"
                                onClick={() => toggleAmenity(amenity.value)}
                                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${selectedAmenities.includes(amenity.value)
                                        ? 'bg-primary-500/80 text-white'
                                        : 'bg-white/5 text-white/70 hover:bg-white/10'
                                    }`}
                            >
                                {amenity.label[lang]}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Submit */}
                <div className="flex justify-end gap-4">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="btn-secondary"
                    >
                        {t(lang, 'إلغاء', 'Cancel')}
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="btn-primary"
                    >
                        {isSubmitting ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                <Save className="w-5 h-5" />
                                <span>{t(lang, 'حفظ الغرفة', 'Save Room')}</span>
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
