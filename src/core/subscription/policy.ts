const DAY_IN_MS = 24 * 60 * 60 * 1000;

export const SUBSCRIPTION_RENEWAL_DAYS = 30;
export const SUBSCRIPTION_WARNING_DAYS = 3;
export const SUBSCRIPTION_GRACE_DAYS = 3;

export function addDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * DAY_IN_MS);
}

function toValidDate(value: Date | string | null | undefined): Date | null {
    if (!value) return null;
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
}

export function getSubscriptionGraceEndDate(
    endDate: Date | string | null | undefined,
    graceDays: number = SUBSCRIPTION_GRACE_DAYS
): Date | null {
    const validEndDate = toValidDate(endDate);
    if (!validEndDate) return null;
    return addDays(validEndDate, graceDays);
}

export function isSubscriptionInGracePeriod(
    endDate: Date | string | null | undefined,
    now: Date = new Date(),
    graceDays: number = SUBSCRIPTION_GRACE_DAYS
): boolean {
    const validEndDate = toValidDate(endDate);
    if (!validEndDate) return false;
    if (now.getTime() <= validEndDate.getTime()) return false;

    const graceEndDate = getSubscriptionGraceEndDate(validEndDate, graceDays);
    if (!graceEndDate) return false;

    return now.getTime() <= graceEndDate.getTime();
}

export function isSubscriptionBeyondGracePeriod(
    endDate: Date | string | null | undefined,
    now: Date = new Date(),
    graceDays: number = SUBSCRIPTION_GRACE_DAYS
): boolean {
    const graceEndDate = getSubscriptionGraceEndDate(endDate, graceDays);
    if (!graceEndDate) return false;
    return now.getTime() > graceEndDate.getTime();
}

export function getSubscriptionTimeline(
    endDate: Date | string | null | undefined,
    now: Date = new Date(),
    warningDays: number = SUBSCRIPTION_WARNING_DAYS,
    graceDays: number = SUBSCRIPTION_GRACE_DAYS
) {
    const validEndDate = toValidDate(endDate);
    if (!validEndDate) {
        return {
            hasEndDate: false,
            endDate: null as Date | null,
            graceEndDate: null as Date | null,
            daysRemaining: null as number | null,
            daysPastEnd: null as number | null,
            isWarningWindow: false,
            isInGracePeriod: false,
            isBeyondGracePeriod: false,
            daysUntilSuspension: null as number | null,
        };
    }

    const graceEndDate = getSubscriptionGraceEndDate(validEndDate, graceDays);
    const daysRemaining = Math.ceil((validEndDate.getTime() - now.getTime()) / DAY_IN_MS);
    const daysPastEnd = now.getTime() > validEndDate.getTime()
        ? Math.ceil((now.getTime() - validEndDate.getTime()) / DAY_IN_MS)
        : 0;
    const isInGracePeriod = isSubscriptionInGracePeriod(validEndDate, now, graceDays);
    const isBeyondGracePeriod = isSubscriptionBeyondGracePeriod(validEndDate, now, graceDays);
    const isWarningWindow = daysRemaining >= 0 && daysRemaining <= warningDays;

    return {
        hasEndDate: true,
        endDate: validEndDate,
        graceEndDate,
        daysRemaining,
        daysPastEnd,
        isWarningWindow,
        isInGracePeriod,
        isBeyondGracePeriod,
        daysUntilSuspension: isInGracePeriod && graceEndDate
            ? Math.max(Math.ceil((graceEndDate.getTime() - now.getTime()) / DAY_IN_MS), 0)
            : null,
    };
}

export function isSubscriptionExpired(
    endDate: Date | string | null | undefined,
    now: Date = new Date()
): boolean {
    return isSubscriptionBeyondGracePeriod(endDate, now, SUBSCRIPTION_GRACE_DAYS);
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
