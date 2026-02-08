'use client';

import Link from 'next/link';
import { Building2, ArrowLeft, Shield } from 'lucide-react';

export default function RegisterPage() {
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

                <div className="card p-8 text-center animate-scale-in">
                    <div className="inline-flex p-4 bg-primary-500/15 rounded-2xl mb-6">
                        <Shield className="w-10 h-10 text-primary-300" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-3">
                        التسجيل عبر السوبر أدمن
                    </h1>
                    <p className="text-white/60">
                        تسجيل الفنادق الجديدة متاح فقط عن طريق لوحة السوبر أدمن.
                    </p>

                    <div className="mt-6">
                        <Link href="/login" className="btn-primary w-full">
                            تسجيل الدخول
                        </Link>
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
