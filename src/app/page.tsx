import Link from 'next/link';
import {
    Building2,
    ArrowLeft,
    Shield,
    Sparkles,
    TrendingUp,
    CheckCircle,
    Users,
    CalendarCheck,
    BellRing,
    Clock3,
    BarChart3,
} from 'lucide-react';

const quickStats = [
    { label: 'جاهزية التشغيل', value: '99.9%', note: 'استقرار البنية' },
    { label: 'مراقبة مستمرة', value: '24/7', note: 'تنبيهات لحظية' },
    { label: 'عمليات يومية', value: '+120', note: 'سير عمل متكامل' },
];

const operationsFlow = [
    {
        title: 'استقبال الحجز',
        desc: 'تأكيد فوري للحجوزات وتحديث الإشغال دون تأخير.',
    },
    {
        title: 'توزيع المهام',
        desc: 'تعيين تلقائي لفريق الاستقبال والنظافة حسب الأولوية.',
    },
    {
        title: 'مراجعة الأداء',
        desc: 'لوحات تقارير مالية وتشغيلية لتقييم اليوم التشغيلي.',
    },
];

const coreFeatures = [
    {
        icon: CalendarCheck,
        title: 'إدارة حجز دقيقة',
        desc: 'عرض فوري لحالة الغرف مع تقليل التعارض في الحجوزات.',
    },
    {
        icon: Shield,
        title: 'عزل بيانات محكم',
        desc: 'كل فندق يعمل ببياناته وصلاحياته ضمن بيئة آمنة.',
    },
    {
        icon: Users,
        title: 'تجربة فريق عملية',
        desc: 'واجهات واضحة تساعد الفريق على إنجاز المهام بسرعة.',
    },
    {
        icon: BarChart3,
        title: 'مؤشرات أداء حية',
        desc: 'متابعة الإيراد والإشغال والتنبيهات من نفس الشاشة.',
    },
];

export default function HomePage() {
    return (
        <main className="landing-shell min-h-screen">
            <div className="landing-grid-overlay" />

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

            <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
                <div className="grid lg:grid-cols-[1.06fr_0.94fr] gap-10 items-center">
                    <div className="space-y-7 landing-fade-up">
                        <span className="badge-primary inline-flex items-center gap-2">
                            <Sparkles className="w-4 h-4" />
                            منصة SaaS متقدمة لإدارة الفنادق
                        </span>

                        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight">
                            إدارة ذكية لكل تفاصيل الفندق
                        </h1>

                        <p className="text-lg text-white/70 max-w-2xl">
                            نظام موحد للحجوزات والغرف والضيوف والتقارير التشغيلية، مع تنبيهات لحظية تساعد
                            الإدارة على اتخاذ قرار أسرع.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4">
                            <Link
                                href="/login"
                                className="btn-primary text-base sm:text-lg px-6 py-3 inline-flex items-center gap-2"
                            >
                                دخول لوحة التحكم
                                <ArrowLeft className="w-4 h-4" />
                            </Link>
                            <a
                                href="https://wa.me/966500000000"
                                target="_blank"
                                rel="noreferrer"
                                className="btn-secondary text-base sm:text-lg px-6 py-3"
                            >
                                طلب عرض تجريبي عبر واتساب
                            </a>
                        </div>

                        <div className="grid grid-cols-3 gap-3 sm:gap-4 max-w-xl">
                            {quickStats.map((stat) => (
                                <div key={stat.label} className="surface-tile px-4 py-3">
                                    <p className="text-lg sm:text-xl font-semibold text-white">{stat.value}</p>
                                    <p className="text-xs text-white/70 mt-1">{stat.label}</p>
                                    <p className="text-[11px] text-white/45 mt-0.5">{stat.note}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="relative landing-fade-up landing-fade-delay">
                        <div className="absolute -inset-2 bg-gradient-to-r from-primary-500/20 to-accent-500/20 blur-2xl" />

                        <div className="card p-5 sm:p-6 space-y-5 relative landing-scanline">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-white/60">صافي إيراد اليوم</p>
                                    <p className="text-3xl font-semibold text-white mt-1">128,400 ر.س</p>
                                </div>
                                <span className="badge-success inline-flex items-center gap-1">
                                    <TrendingUp className="w-3.5 h-3.5" />
                                    +12.4%
                                </span>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs text-white/60">
                                    <span>إشغال الغرف</span>
                                    <span>74%</span>
                                </div>
                                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                                    <div className="h-full w-[74%] rounded-full bg-gradient-to-r from-primary-500 to-accent-500" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="surface-tile p-3">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs text-white/60">الحجوزات الجديدة</p>
                                        <CalendarCheck className="w-4 h-4 text-accent-300" />
                                    </div>
                                    <p className="text-2xl font-semibold text-white mt-2">42</p>
                                </div>
                                <div className="surface-tile p-3">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs text-white/60">طلبات الخدمة</p>
                                        <BellRing className="w-4 h-4 text-warning-500" />
                                    </div>
                                    <p className="text-2xl font-semibold text-white mt-2">9</p>
                                </div>
                            </div>

                            <div className="surface-tile p-3">
                                <div className="flex items-center justify-between text-xs text-white/60">
                                    <span>المهام الحرجة المفتوحة</span>
                                    <Clock3 className="w-4 h-4 text-primary-300" />
                                </div>
                                <div className="flex items-center justify-between mt-2">
                                    <p className="text-white font-medium">استجابة فريق التشغيل</p>
                                    <p className="text-success-500 text-sm">ضمن الهدف</p>
                                </div>
                            </div>
                        </div>

                        <div className="card p-4 absolute -top-6 -left-3 sm:-left-5 w-[56%] hidden sm:block landing-panel-float-slow">
                            <div className="flex items-center gap-2 text-xs text-white/65 mb-2">
                                <CheckCircle className="w-3.5 h-3.5 text-success-500" />
                                حالة المنصة
                            </div>
                            <p className="text-sm text-white font-medium">متزامنة بالكامل</p>
                            <p className="text-[11px] text-white/55 mt-1">لا توجد أعطال حرجة حالياً</p>
                        </div>

                        <div className="card p-4 absolute -bottom-8 -right-3 sm:-right-5 w-[72%] landing-panel-float">
                            <div className="flex items-center justify-between">
                                <p className="text-xs text-white/60">تحديثات مباشرة</p>
                                <span className="badge-primary">Live</span>
                            </div>
                            <div className="mt-2 space-y-2 text-sm">
                                <div className="flex items-center justify-between">
                                    <span className="text-white/70">تسجيل دخول مدير الفندق</span>
                                    <span className="text-white/45 text-xs">الآن</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-white/70">تأكيد حجز جديد</span>
                                    <span className="text-white/45 text-xs">قبل 3 د</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-white/70">إغلاق وردية الاستقبال</span>
                                    <span className="text-white/45 text-xs">قبل 12 د</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
                <div className="grid lg:grid-cols-[1.04fr_0.96fr] gap-6">
                    <div className="card p-6 landing-fade-up">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-xl font-semibold text-white">سير العمل اليومي</h2>
                            <span className="badge-primary">تشغيل منظم</span>
                        </div>
                        <div className="space-y-3">
                            {operationsFlow.map((step, index) => (
                                <div
                                    key={step.title}
                                    className="surface-tile flex items-start gap-3 p-4 border-white/10"
                                >
                                    <div className="min-w-7 h-7 rounded-lg bg-primary-500/20 text-primary-300 text-xs font-semibold flex items-center justify-center mt-0.5">
                                        {index + 1}
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-white">{step.title}</h3>
                                        <p className="text-xs text-white/60 mt-1">{step.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                        {coreFeatures.map((feature) => (
                            <div key={feature.title} className="card p-5 space-y-4 landing-fade-up">
                                <div className="p-3 rounded-xl bg-primary-500/15 w-fit">
                                    <feature.icon className="w-5 h-5 text-primary-300" />
                                </div>
                                <h3 className="text-base font-semibold text-white">{feature.title}</h3>
                                <p className="text-sm text-white/60">{feature.desc}</p>
                                <div className="flex items-center gap-2 text-xs text-white/45">
                                    <CheckCircle className="w-4 h-4 text-success-500" />
                                    جاهز للتوسع
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </main>
    );
}
