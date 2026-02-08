import Link from 'next/link';
import {
    Building2,
    ArrowLeft,
    Shield,
    Sparkles,
    TrendingUp,
    CheckCircle,
    Users,
    BedDouble,
    CalendarCheck,
} from 'lucide-react';

export default function HomePage() {
    return (
        <main className="min-h-screen">
            <div className="relative overflow-hidden">
                <div className="absolute inset-0 opacity-20 pointer-events-none">
                    <div
                        className="absolute inset-0"
                        style={{
                            backgroundImage:
                                'radial-gradient(circle at 20% 20%, rgba(124, 58, 237, 0.45), transparent 40%), radial-gradient(circle at 80% 15%, rgba(244, 63, 140, 0.3), transparent 40%)',
                        }}
                    />
                </div>

                <header className="relative z-10 border-b border-white/5 backdrop-blur-xl">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-primary-500/20 border border-primary-500/30">
                                <Building2 className="w-5 h-5 text-primary-300" />
                            </div>
                            <span className="text-white font-semibold tracking-wide">HMS</span>
                        </div>
                        <div className="flex-1" />
                        <Link href="/login" className="btn-secondary">
                            تسجيل الدخول
                        </Link>
                    </div>
                </header>

                <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        <div className="space-y-6">
                            <span className="badge-primary inline-flex items-center gap-2">
                                <Sparkles className="w-4 h-4" />
                                منصة SaaS متقدمة لإدارة الفنادق
                            </span>
                            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight">
                                إدارة ذكية لكل تفاصيل الفندق
                            </h1>
                            <p className="text-lg text-white/70">
                                نظام موحد لتشغيل الحجوزات، الغرف، والنزلاء مع لوحات تحكم فورية وتقارير دقيقة.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4">
                                <Link href="/login" className="btn-primary text-lg px-6 py-3">
                                    دخول لوحة التحكم
                                </Link>
                                <button type="button" disabled className="btn-secondary text-lg px-6 py-3 opacity-70">
                                    تسجيل فندق جديد مراسلة وكلائنا ع الواتساب
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-6 text-sm text-white/60">
                                <div>
                                    <p className="text-white text-xl font-semibold">99.9%</p>
                                    <p>جاهزية التشغيل</p>
                                </div>
                                <div>
                                    <p className="text-white text-xl font-semibold">24/7</p>
                                    <p>مراقبة النظام</p>
                                </div>
                                <div>
                                    <p className="text-white text-xl font-semibold">+120</p>
                                    <p>عملية يومية</p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="card p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-white/60">القيمة التشغيلية</p>
                                        <p className="text-3xl font-semibold text-white">3.4M ر.س</p>
                                    </div>
                                    <div className="badge-success">+8.2%</div>
                                </div>
                                <div className="mt-4 h-2 rounded-full bg-white/10 overflow-hidden">
                                    <div className="h-full w-2/3 bg-gradient-to-r from-primary-500 to-accent-500" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="card p-5">
                                    <div className="flex items-center gap-3 mb-3">
                                        <BedDouble className="w-5 h-5 text-primary-300" />
                                        <p className="text-sm text-white/60">الإشغال</p>
                                    </div>
                                    <p className="text-2xl font-semibold text-white">68%</p>
                                </div>
                                <div className="card p-5">
                                    <div className="flex items-center gap-3 mb-3">
                                        <CalendarCheck className="w-5 h-5 text-accent-300" />
                                        <p className="text-sm text-white/60">الحجوزات</p>
                                    </div>
                                    <p className="text-2xl font-semibold text-white">72</p>
                                </div>
                            </div>
                            <div className="card p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <p className="text-sm text-white/60">اتجاه الأداء</p>
                                    <TrendingUp className="w-4 h-4 text-success-500" />
                                </div>
                                <div className="h-24 bg-gradient-to-b from-primary-500/30 to-transparent rounded-xl border border-white/5" />
                            </div>
                        </div>
                    </div>
                </section>
            </div>

            <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
                <div className="grid md:grid-cols-3 gap-6">
                    {[
                        {
                            icon: CalendarCheck,
                            title: 'إدارة الحجوزات',
                            desc: 'مزامنة فورية للحجوزات وتوافر الغرف مع إشعارات دقيقة.',
                        },
                        {
                            icon: Shield,
                            title: 'أمان وعزل البيانات',
                            desc: 'سياسات أمان متعددة المستويات مع عزل كامل لكل فندق.',
                        },
                        {
                            icon: Users,
                            title: 'تجربة فريق محسنة',
                            desc: 'لوحات تشغيل واضحة تسرّع إنجاز المهام اليومية.',
                        },
                    ].map((feature) => (
                        <div key={feature.title} className="card p-6 space-y-4">
                            <div className="p-3 rounded-xl bg-primary-500/15 w-fit">
                                <feature.icon className="w-6 h-6 text-primary-300" />
                            </div>
                            <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
                            <p className="text-sm text-white/60">{feature.desc}</p>
                            <div className="flex items-center gap-2 text-xs text-white/40">
                                <CheckCircle className="w-4 h-4" />
                                جاهز للتوسع
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </main>
    );
}
