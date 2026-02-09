const DAY_IN_MS = 24 * 60 * 60 * 1000;

export const SUBSCRIPTION_RENEWAL_DAYS = 30;

export function addDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * DAY_IN_MS);
}

export function isSubscriptionExpired(
    endDate: Date | string | null | undefined,
    now: Date = new Date()
): boolean {
    if (!endDate) return false;
    const parsed = endDate instanceof Date ? endDate : new Date(endDate);
    if (Number.isNaN(parsed.getTime())) return false;
    return parsed.getTime() < now.getTime();
}

export function computeRenewalEndDate(
    currentEndDate: Date | string | null | undefined,
    paymentDate: Date,
    renewalDays: number = SUBSCRIPTION_RENEWAL_DAYS
): Date {
    const current =
        currentEndDate instanceof Date
            ? currentEndDate
            : currentEndDate
                ? new Date(currentEndDate)
                : null;

    const baseDate =
        current && !Number.isNaN(current.getTime()) && current.getTime() > paymentDate.getTime()
            ? current
            : paymentDate;

    return addDays(baseDate, renewalDays);
}

