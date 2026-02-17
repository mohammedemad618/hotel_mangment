import { hashPassword, verifyPassword } from './password';

const PIN_REGEX = /^\d{4}$/;

function normalizePin(pin: string): string {
    return pin.replace(/\s+/g, '').trim();
}

export function isValidPin(pin: string): boolean {
    return PIN_REGEX.test(normalizePin(pin));
}

export function isPinHash(value: unknown): boolean {
    return typeof value === 'string' && value.startsWith('$argon2');
}

export async function hashPin(pin: string): Promise<string> {
    const normalized = normalizePin(pin);
    if (!isValidPin(normalized)) {
        throw new Error('Invalid PIN format');
    }
    return hashPassword(normalized);
}

export async function verifyPin(pin: string, hash: string | null | undefined): Promise<boolean> {
    if (!hash || !isPinHash(hash)) return false;
    const normalized = normalizePin(pin);
    if (!isValidPin(normalized)) return false;
    return verifyPassword(normalized, hash);
}

export function isPinConfigured(input: { mfaEnabled?: boolean; mfaSecret?: string | null }): boolean {
    return Boolean(input.mfaEnabled) && isPinHash(input.mfaSecret || null);
}
