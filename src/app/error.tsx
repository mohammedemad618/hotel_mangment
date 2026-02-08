'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <main className="min-h-screen flex flex-col items-center justify-center text-center px-6">
            <h1 className="text-3xl font-bold text-white">حدث خطأ غير متوقع</h1>
            <p className="mt-2 text-white/60">
                حاول مرة أخرى أو عد إلى لوحة التحكم.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <button type="button" onClick={reset} className="btn-primary px-6">
                    إعادة المحاولة
                </button>
                <Link href="/dashboard" className="btn-secondary px-6">
                    لوحة التحكم
                </Link>
            </div>
        </main>
    );
}
