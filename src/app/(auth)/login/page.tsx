'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Building2, Mail, Lock, Eye, EyeOff, ArrowLeft, Loader2 } from 'lucide-react';
import { loginSchema, LoginInput } from '@/lib/validations';

export default function LoginPage() {
    const router = useRouter();
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<LoginInput>({
        resolver: zodResolver(loginSchema),
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

            if (result.user.role === 'super_admin') {
                router.push('/super-admin');
            } else {
                router.push('/dashboard');
            }

        } catch (err) {
            setError('حدث خطأ في الاتصال بالخادم');
        }
    };

    return (
        <main className="min-h-screen flex items-center justify-center p-4">
            <div className="relative w-full max-w-md">
                {/* Logo */}
                <div className="flex justify-center mb-8">
                    <Link href="/" className="flex items-center gap-3 group">
                        <div className="p-3 rounded-xl bg-primary-500/20 border border-primary-500/30 group-hover:bg-primary-500/30 transition-colors">
                            <Building2 className="w-9 h-9 text-primary-200" />
                        </div>
                        <span className="text-2xl font-semibold text-white">HMS</span>
                    </Link>
                </div>

                {/* Login Card */}
                <div className="card p-8 animate-scale-in">
                    <div className="text-center mb-8">
                        <h1 className="text-2xl font-bold text-white mb-2">
                            تسجيل الدخول
                        </h1>
                        <p className="text-white/60">
                            أدخل بياناتك للوصول إلى لوحة التحكم
                        </p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 p-4 bg-danger-500/10 border border-danger-500/20 rounded-xl text-danger-500 text-sm animate-slide-down">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        {/* Email Field */}
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

                        {/* Password Field */}
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

                        {/* Submit Button */}
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

                    {/* Footer */}
                    <div className="mt-8 text-center">
                        <p className="text-white/50 text-sm">
                            تسجيل الفنادق متاح فقط عبر امراسلة وكلائنا على الواتساب.
                        </p>
                    </div>
                </div>

                {/* Back to Home */}
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
