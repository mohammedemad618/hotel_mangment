import { z } from 'zod';

// ========================================
// Auth Schemas
// ========================================

export const loginSchema = z.object({
    email: z
        .string()
        .email('البريد الإلكتروني غير صالح')
        .toLowerCase()
        .trim(),
    password: z
        .string()
        .min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'),
});

export const registerHotelSchema = z.object({
    hotelName: z
        .string()
        .min(2, 'اسم الفندق مطلوب')
        .max(100, 'اسم الفندق لا يمكن أن يتجاوز 100 حرف'),
    email: z
        .string()
        .email('البريد الإلكتروني غير صالح')
        .toLowerCase()
        .trim(),
    password: z
        .string()
        .min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'),
    phone: z
        .string()
        .min(10, 'رقم الهاتف يجب أن يكون 10 أرقام على الأقل'),
    city: z
        .string()
        .min(2, 'المدينة مطلوبة'),
    country: z
        .string()
        .min(2, 'الدولة مطلوبة'),
    adminName: z
        .string()
        .min(2, 'اسم المدير مطلوب'),
});

export const createUserSchema = z.object({
    name: z
        .string()
        .min(2, 'الاسم مطلوب')
        .max(100, 'الاسم لا يمكن أن يتجاوز 100 حرف'),
    email: z
        .string()
        .email('البريد الإلكتروني غير صالح')
        .toLowerCase()
        .trim(),
    password: z
        .string()
        .min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'),
    role: z.enum(['super_admin', 'sub_super_admin', 'admin', 'manager', 'receptionist', 'housekeeping', 'accountant'], {
        errorMap: () => ({ message: 'الدور غير صالح' }),
    }),
    hotelId: z.string().optional().nullable(),
}).superRefine((data, ctx) => {
    if (data.role === 'super_admin' || data.role === 'sub_super_admin') {
        if (data.hotelId) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Platform roles cannot be linked to a hotel',
                path: ['hotelId'],
            });
        }
        return;
    }

    if (!data.hotelId) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'الفندق مطلوب لهذا الدور',
            path: ['hotelId'],
        });
        return;
    }

    if (!/^[a-f\d]{24}$/i.test(data.hotelId)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'معرف الفندق غير صالح',
            path: ['hotelId'],
        });
    }
});

// ========================================
// Room Schemas
// ========================================

export const createRoomSchema = z.object({
    roomNumber: z
        .string()
        .min(1, 'رقم الغرفة مطلوب')
        .max(20, 'رقم الغرفة لا يمكن أن يتجاوز 20 حرف'),
    floor: z
        .number()
        .int()
        .min(0, 'رقم الطابق يجب أن يكون 0 أو أكثر'),
    type: z.enum(['single', 'double', 'twin', 'suite', 'deluxe', 'presidential'], {
        errorMap: () => ({ message: 'نوع الغرفة غير صالح' }),
    }),
    pricePerNight: z
        .number()
        .positive('السعر يجب أن يكون رقماً موجباً'),
    capacity: z.object({
        adults: z.number().int().min(1, 'عدد البالغين يجب أن يكون 1 على الأقل'),
        children: z.number().int().min(0).default(0),
    }).optional(),
    amenities: z.array(z.string()).optional(),
    description: z.string().max(500).optional(),
});

export const updateRoomSchema = createRoomSchema.partial();

// ========================================
// Booking Schemas
// ========================================

const bookingBaseSchema = z.object({
    roomId: z.string().min(1, 'الغرفة مطلوبة'),
    guestId: z.string().min(1, 'النزيل مطلوب'),
    checkInDate: z.string().transform((val) => new Date(val)),
    checkOutDate: z.string().transform((val) => new Date(val)),
    numberOfGuests: z.object({
        adults: z.number().int().min(1),
        children: z.number().int().min(0).default(0),
    }),
    source: z.enum(['direct', 'website', 'phone', 'walkin', 'ota']).optional(),
    specialRequests: z.string().max(500).optional(),
    notes: z.string().max(1000).optional(),
});

export const createBookingSchema = bookingBaseSchema.refine((data) => data.checkOutDate > data.checkInDate, {
    message: 'تاريخ المغادرة يجب أن يكون بعد تاريخ الوصول',
    path: ['checkOutDate'],
});

export const updateBookingSchema = bookingBaseSchema.partial().superRefine((data, ctx) => {
    if (data.checkInDate && data.checkOutDate && data.checkOutDate <= data.checkInDate) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'تاريخ المغادرة يجب أن يكون بعد تاريخ الوصول',
            path: ['checkOutDate'],
        });
    }
});

// ========================================
// Guest Schemas
// ========================================

export const createGuestSchema = z.object({
    firstName: z
        .string()
        .min(1, 'الاسم الأول مطلوب')
        .max(50, 'الاسم الأول لا يمكن أن يتجاوز 50 حرف'),
    lastName: z
        .string()
        .min(1, 'الاسم الأخير مطلوب')
        .max(50, 'الاسم الأخير لا يمكن أن يتجاوز 50 حرف'),
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().min(10, 'رقم الهاتف مطلوب'),
    nationality: z.string().min(2, 'الجنسية مطلوبة'),
    idType: z.enum(['passport', 'national_id', 'driver_license']),
    idNumber: z.string().min(1, 'رقم الهوية مطلوب'),
    dateOfBirth: z.string().transform((val) => new Date(val)).optional(),
    guestType: z.enum(['individual', 'corporate', 'vip']).optional(),
    companyName: z.string().optional(),
    notes: z.string().max(1000).optional(),
});

export const updateGuestSchema = createGuestSchema.partial();

// ========================================
// Settings Schemas
// ========================================

export const hotelSettingsSchema = z.object({
    hotelName: z
        .string()
        .min(2, 'اسم الفندق مطلوب')
        .max(100, 'اسم الفندق لا يمكن أن يتجاوز 100 حرف'),
    logo: z.string().max(2000000, 'حجم الشعار كبير').optional().or(z.literal('')),
    email: z
        .string()
        .email('البريد الإلكتروني غير صالح')
        .toLowerCase()
        .trim(),
    phone: z
        .string()
        .min(10, 'رقم الهاتف يجب أن يكون 10 أرقام على الأقل'),
    settings: z.object({
        currency: z.string().min(1, 'العملة مطلوبة'),
        timezone: z.string().min(1, 'المنطقة الزمنية مطلوبة'),
        language: z.enum(['ar', 'en']),
        checkInTime: z.string().regex(/^\d{2}:\d{2}$/, 'تنسيق وقت غير صالح'),
        checkOutTime: z.string().regex(/^\d{2}:\d{2}$/, 'تنسيق وقت غير صالح'),
        taxRate: z.number().min(0, 'قيمة الضريبة لا يمكن أن تكون سالبة').max(30, 'الحد الأقصى للضريبة هو 30%'),
        theme: z.enum(['light', 'dark', 'system']).optional(),
        notifications: z.object({
            newBooking: z.boolean(),
            cancelledBooking: z.boolean(),
            paymentReceived: z.boolean(),
            dailyReport: z.boolean(),
        }).optional(),
    }),
});

// ========================================
// Types
// ========================================

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterHotelInput = z.infer<typeof registerHotelSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type UpdateBookingInput = z.infer<typeof updateBookingSchema>;
export type CreateGuestInput = z.infer<typeof createGuestSchema>;
export type UpdateGuestInput = z.infer<typeof updateGuestSchema>;
export type HotelSettingsInput = z.infer<typeof hotelSettingsSchema>;

