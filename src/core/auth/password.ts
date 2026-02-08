import * as argon2 from 'argon2';

// ========================================
// Password Hashing with Argon2
// ========================================

const ARGON2_OPTIONS: argon2.Options = {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 4,
    hashLength: 32,
};

/**
 * Hash a password using Argon2id
 */
export async function hashPassword(password: string): Promise<string> {
    return argon2.hash(password, ARGON2_OPTIONS);
}

/**
 * Verify a password against its hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
        return await argon2.verify(hash, password);
    } catch (error) {
        // Invalid hash format or other error
        return false;
    }
}

/**
 * Check if a password needs rehashing (e.g., if options changed)
 */
export function needsRehash(hash: string): boolean {
    return argon2.needsRehash(hash, ARGON2_OPTIONS);
}

// ========================================
// Password Validation
// ========================================

export interface PasswordValidationResult {
    isValid: boolean;
    errors: string[];
}

export function validatePasswordStrength(password: string): PasswordValidationResult {
    const errors: string[] = [];

    if (password.length < 8) {
        errors.push('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
    }

    if (password.length > 128) {
        errors.push('كلمة المرور لا يمكن أن تتجاوز 128 حرف');
    }

    if (!/[a-z]/.test(password)) {
        errors.push('يجب أن تحتوي على حرف صغير واحد على الأقل');
    }

    if (!/[A-Z]/.test(password)) {
        errors.push('يجب أن تحتوي على حرف كبير واحد على الأقل');
    }

    if (!/[0-9]/.test(password)) {
        errors.push('يجب أن تحتوي على رقم واحد على الأقل');
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        errors.push('يجب أن تحتوي على رمز خاص واحد على الأقل');
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
}
