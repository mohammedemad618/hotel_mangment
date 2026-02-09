export type AppLanguage = 'ar' | 'en';

export function normalizeLanguage(value: unknown): AppLanguage {
    return value === 'en' ? 'en' : 'ar';
}

/**
 * Minimal translation helper.
 * Usage: t(lang, 'نص عربي', 'English text')
 */
export function t(lang: AppLanguage, ar: string, en: string): string {
    return lang === 'en' ? en : ar;
}

