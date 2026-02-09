export function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizeSearchTerm(value: string | null, maxLength = 80): string {
    if (!value) {
        return '';
    }
    return value.trim().slice(0, maxLength);
}

