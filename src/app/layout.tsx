import type { Metadata, Viewport } from 'next';
import { Space_Grotesk, IBM_Plex_Sans_Arabic } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const space = Space_Grotesk({
    subsets: ['latin'],
    variable: '--font-space',
    display: 'swap',
});

const ibmArabic = IBM_Plex_Sans_Arabic({
    subsets: ['arabic'],
    variable: '--font-ibm-arabic',
    display: 'swap',
    weight: ['300', '400', '500', '600', '700'],
});

export const metadata: Metadata = {
    title: 'نظام إدارة الفنادق | Hotel Management System',
    description: 'نظام متكامل لإدارة الفنادق والحجوزات - A comprehensive hotel management system',
    keywords: ['hotel', 'management', 'booking', 'فندق', 'حجوزات', 'إدارة'],
    authors: [{ name: 'HMS Team' }],
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="ar" dir="rtl" className="dark" suppressHydrationWarning>
            <body className={`${space.variable} ${ibmArabic.variable} font-sans antialiased`}>
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
