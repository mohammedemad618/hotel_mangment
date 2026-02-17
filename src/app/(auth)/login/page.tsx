'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
    ArrowLeft,
    Building2,
    Eye,
    EyeOff,
    KeyRound,
    Loader2,
    Lock,
    Mail,
    ShieldCheck,
} from 'lucide-react';
import { loginSchema, LoginInput } from '@/lib/validations';

type LoginStep = 'credentials' | 'pin';

function redirectByRole(router: ReturnType<typeof useRouter>, role?: string) {
    if (role === 'super_admin' || role === 'sub_super_admin') {
        router.push('/super-admin');
        return;
    }
    router.push('/dashboard');
}

export default function LoginPage() {
    const router = useRouter();
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [step, setStep] = useState<LoginStep>('credentials');
    const [setupRequired, setSetupRequired] = useState(false);
    const [pendingRole, setPendingRole] = useState<string | null>(null);
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [pinSubmitting, setPinSubmitting] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<LoginInput>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: '',
            password: '',
        },
    });

    const onSubmit = async (data: LoginInput) => {
        setError(null);

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            const result = await response.json();
            if (!response.ok) {
                setError(result.error || 'حدث خطأ أثناء تسجيل الدخول');
                return;
            }

            if (result.pinRequired) {
                setStep('pin');
                setSetupRequired(Boolean(result.setupRequired));
                setPendingRole(result.user?.role || null);
                setPin('');
                setConfirmPin('');
                return;
            }

            redirectByRole(router, result.user?.role);
        } catch {
            setError('حدث خطأ في الاتصال بالخادم');
        }
    };

    const submitPin = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);

        const normalizedPin = pin.trim();
        if (!/^\d{4}$/.test(normalizedPin)) {
            setError('الـ PIN يجب أن يكون 4 أرقام');
            return;
        }

        if (setupRequired && normalizedPin !== confirmPin.trim()) {
            setError('تأكيد الـ PIN غير مطابق');
            return;
        }

        setPinSubmitting(true);
        try {
            const endpoint = setupRequired ? '/api/auth/pin/setup' : '/api/auth/pin/verify';
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin: normalizedPin }),
            });

            const result = await response.json();
            if (!response.ok) {
                setError(result.error || 'فشل التحقق من PIN');
                return;
            }

            redirectByRole(router, result.user?.role || pendingRole || undefined);
        } catch {
            setError('فشل التحقق من PIN');
        } finally {
            setPinSubmitting(false);
        }
    };

    const backToCredentials = () => {
        setStep('credentials');
        setSetupRequired(false);
        setPendingRole(null);
        setPin('');
        setConfirmPin('');
        setError(null);
    };

    return (
        <main className="min-h-screen flex items-center justify-center p-4">
            <div className="relative w-full max-w-md">
                <div className="flex justify-center mb-8">
                    <Link href="/" className="flex items-center gap-3 group">
                        <div className="p-3 rounded-xl bg-primary-500/20 border border-primary-500/30 group-hover:bg-primary-500/30 transition-colors">
                            <Building2 className="w-9 h-9 text-primary-200" />
                        </div>
                        <span className="text-2xl font-semibold text-white">HMS</span>
                    </Link>
                </div>

                <div className="card p-8 animate-scale-in">
                    <div className="text-center mb-8">
                        <h1 className="text-2xl font-bold text-white mb-2">
                            {step === 'credentials' ? 'تسجيل الدخول' : setupRequired ? 'إعداد PIN' : 'التحقق من PIN'}
                        </h1>
                        <p className="text-white/60">
                            {step === 'credentials'
                                ? 'أدخل بياناتك للوصول إلى لوحة التحكم'
                                : setupRequired
                                    ? 'أنشئ رمز PIN مكوّن من 4 أرقام لحسابك'
                                    : 'أدخل PIN للمتابعة'}
                        </p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-danger-500/10 border border-danger-500/20 rounded-xl text-danger-500 text-sm animate-slide-down">
                            {error}
                        </div>
                    )}

                    {step === 'credentials' ? (
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-white/70 mb-2">
                                    البريد الإلكتروني
                                </label>
                                <div className="relative">
                                    <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                                    <input
                                        id="email"
                                        type="email"
                                        {...register('email')}
                                        className="input pr-12"
                                        placeholder="example@hotel.com"
                                        dir="ltr"
                                    />
                                </div>
                                {errors.email && (
                                    <p className="mt-1 text-sm text-danger-500">{errors.email.message}</p>
                                )}
                            </div>

                            <div>
                                <label htmlFor="password" className="block text-sm font-medium text-white/70 mb-2">
                                    كلمة المرور
                                </label>
                                <div className="relative">
                                    <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                                    <input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        {...register('password')}
                                        className="input pr-12 pl-12"
                                        placeholder="••••••••"
                                        dir="ltr"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                                {errors.password && (
                                    <p className="mt-1 text-sm text-danger-500">{errors.password.message}</p>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="btn-primary w-full py-4 text-lg group"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        <span>تسجيل الدخول</span>
                                        <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
                                    </>
                                )}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={submitPin} className="space-y-4">
                            <div>
                                <label htmlFor="pin" className="block text-sm font-medium text-white/70 mb-2">
                                    PIN
                                </label>
                                <div className="relative">
                                    <KeyRound className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                                    <input
                                        id="pin"
                                        value={pin}
                                        onChange={(event) => setPin(event.target.value)}
                                        className="input pr-12"
                                        placeholder="1234"
                                        dir="ltr"
                                        inputMode="numeric"
                                        maxLength={4}
                                    />
                                </div>
                            </div>

                            {setupRequired && (
                                <div>
                                    <label htmlFor="confirmPin" className="block text-sm font-medium text-white/70 mb-2">
                                        تأكيد PIN
                                    </label>
                                    <div className="relative">
                                        <ShieldCheck className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                                        <input
                                            id="confirmPin"
                                            value={confirmPin}
                                            onChange={(event) => setConfirmPin(event.target.value)}
                                            className="input pr-12"
                                            placeholder="1234"
                                            dir="ltr"
                                            inputMode="numeric"
                                            maxLength={4}
                                        />
                                    </div>
                                </div>
                            )}

                            <button type="submit" disabled={pinSubmitting} className="btn-primary w-full py-4 text-lg group">
                                {pinSubmitting ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        <span>{setupRequired ? 'حفظ PIN والمتابعة' : 'تأكيد PIN'}</span>
                                        <ShieldCheck className="w-5 h-5" />
                                    </>
                                )}
                            </button>

                            <button type="button" className="btn-secondary w-full py-3" onClick={backToCredentials}>
                                الرجوع لتسجيل الدخول
                            </button>
                        </form>
                    )}

                    <div className="mt-8 text-center">
                        <p className="text-white/50 text-sm">
                            تسجيل الفنادق متاح فقط عبر التواصل مع فريق الدعم.
                        </p>
                    </div>
                </div>

                <div className="mt-6 text-center">
                    <Link href="/" className="text-white/70 hover:text-white text-sm inline-flex items-center gap-2">
                        <ArrowLeft className="w-4 h-4 rotate-180" />
                        <span>العودة للصفحة الرئيسية</span>
                    </Link>
                </div>
            </div>
        </main>
    );
}
