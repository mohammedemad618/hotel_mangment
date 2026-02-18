import {
    computeRenewalEndDate,
    FREE_SUBSCRIPTION_RENEWAL_DAYS,
    SUBSCRIPTION_RENEWAL_DAYS,
    getRenewalDaysForPlan,
} from './policy';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

describe('subscription policy renewal rules', () => {
    it('uses 14 days for free plan and 30 days for non-free plans', () => {
        expect(getRenewalDaysForPlan('free')).toBe(FREE_SUBSCRIPTION_RENEWAL_DAYS);
        expect(getRenewalDaysForPlan('basic')).toBe(SUBSCRIPTION_RENEWAL_DAYS);
        expect(getRenewalDaysForPlan('premium')).toBe(SUBSCRIPTION_RENEWAL_DAYS);
    });

    it('computes free-plan renewal end date from payment date', () => {
        const paymentDate = new Date('2026-01-01T00:00:00.000Z');
        const endDate = computeRenewalEndDate(null, paymentDate, 'free');

        expect(endDate.getTime()).toBe(
            paymentDate.getTime() + FREE_SUBSCRIPTION_RENEWAL_DAYS * DAY_IN_MS
        );
    });

    it('extends from current end date when current subscription ends after payment date', () => {
        const currentEndDate = new Date('2026-02-10T00:00:00.000Z');
        const paymentDate = new Date('2026-02-01T00:00:00.000Z');

        const endDate = computeRenewalEndDate(currentEndDate, paymentDate, 'free');
        expect(endDate.getTime()).toBe(
            currentEndDate.getTime() + FREE_SUBSCRIPTION_RENEWAL_DAYS * DAY_IN_MS
        );
    });
});
