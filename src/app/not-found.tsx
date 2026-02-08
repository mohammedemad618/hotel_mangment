import Link from 'next/link';

export default function NotFound() {
    return (
        <main className="min-h-screen flex flex-col items-center justify-center text-center px-6">
            <h1 className="text-3xl font-bold text-white">الصفحة غير موجودة</h1>
            <p className="mt-2 text-white/60">
                الرابط غير صحيح أو الصفحة تم حذفها.
            </p>
            <Link href="/dashboard" className="btn-primary mt-6">
                العودة إلى لوحة التحكم
            </Link>
        </main>
    );
}
