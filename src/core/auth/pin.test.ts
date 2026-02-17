import { hashPin, isPinConfigured, isPinHash, isValidPin, verifyPin } from './pin';

describe('PIN auth utilities', () => {
    it('validates PIN format', () => {
        expect(isValidPin('1234')).toBe(true);
        expect(isValidPin('12a4')).toBe(false);
        expect(isValidPin('12345')).toBe(false);
    });

    it('hashes and verifies PIN', async () => {
        const hash = await hashPin('2468');
        expect(isPinHash(hash)).toBe(true);
        await expect(verifyPin('2468', hash)).resolves.toBe(true);
        await expect(verifyPin('1111', hash)).resolves.toBe(false);
    });

    it('detects configured PIN state', async () => {
        const hash = await hashPin('1357');
        expect(
            isPinConfigured({
                mfaEnabled: true,
                mfaSecret: hash,
            })
        ).toBe(true);
        expect(
            isPinConfigured({
                mfaEnabled: true,
                mfaSecret: 'JBSWY3DPEHPK3PXP',
            })
        ).toBe(false);
    });
});
