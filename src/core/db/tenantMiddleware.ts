import { NextRequest } from 'next/server';
import mongoose, { Query, Document, Schema } from 'mongoose';
import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Tenant Isolation Middleware
 * 
 * This module provides utilities to ensure data isolation between hotels (tenants).
 * It's a critical security measure to prevent data leakage.
 */

/**
 * Extract hotelId from the authenticated user's token
 * This should be called after authentication middleware
 */
export function getTenantId(request: NextRequest): string | null {
    // The hotelId is set by the auth middleware after token verification
    const hotelId = request.headers.get('x-hotel-id');
    return hotelId;
}

// ========================================
// Async Context for Tenant
// ========================================

type TenantStore = { hotelId?: string };
const tenantStorage = new AsyncLocalStorage<TenantStore>();

export function runWithTenant<T>(hotelId: string, fn: () => Promise<T>): Promise<T> {
    return tenantStorage.run({ hotelId }, fn);
}

export function getTenantFromContext(): string | undefined {
    return tenantStorage.getStore()?.hotelId;
}

function hasHotelIdCondition(query: Record<string, any>): boolean {
    if (!query || typeof query !== 'object') return false;
    if (Object.prototype.hasOwnProperty.call(query, 'hotelId')) return true;

    const keys = ['$and', '$or', '$nor'];
    for (const key of keys) {
        const value = query[key];
        if (Array.isArray(value) && value.some((item) => hasHotelIdCondition(item))) {
            return true;
        }
    }
    return false;
}

export function tenantPlugin(schema: Schema) {
    if (!schema.path('hotelId')) return;

    const applyTenant = function (this: Query<any, any>) {
        const tenantId = getTenantFromContext();
        if (!tenantId) return;

        const currentQuery = this.getQuery();
        if (hasHotelIdCondition(currentQuery)) return;

        this.where('hotelId').equals(new mongoose.Types.ObjectId(tenantId));
    };

    schema.pre(
        [
            'find',
            'findOne',
            'findOneAndUpdate',
            'findOneAndDelete',
            'updateMany',
            'updateOne',
            'countDocuments',
            'deleteOne',
            'deleteMany',
        ],
        applyTenant
    );

    schema.pre('aggregate', function () {
        const tenantId = getTenantFromContext();
        if (!tenantId) return;

        const pipeline = this.pipeline();
        const hasMatch = pipeline.some(
            (stage: any) => stage?.$match && hasHotelIdCondition(stage.$match)
        );

        if (!hasMatch) {
            pipeline.unshift({
                $match: { hotelId: new mongoose.Types.ObjectId(tenantId) },
            });
        }
    });
}

/**
 * Apply tenant filter to mongoose queries
 * This is used in model middleware to automatically inject hotelId
 */
export function applyTenantFilter<T extends Document>(
    query: Query<any, T>,
    hotelId: string | mongoose.Types.ObjectId
): void {
    const conditions = query.getQuery();

    // Only apply if hotelId not already set and model has hotelId field
    if (!conditions.hotelId) {
        query.where('hotelId').equals(new mongoose.Types.ObjectId(hotelId.toString()));
    }
}

/**
 * Middleware to validate tenant access
 * Ensures the document belongs to the requesting tenant
 */
export async function validateTenantAccess<T extends { hotelId: mongoose.Types.ObjectId }>(
    document: T | null,
    requestedHotelId: string
): Promise<boolean> {
    if (!document) return false;
    return document.hotelId.toString() === requestedHotelId;
}

/**
 * Create a tenant-scoped query helper
 * Returns a function that automatically adds hotelId to queries
 */
export function createTenantQuery(hotelId: string) {
    return {
        filter: (additionalFilters: Record<string, any> = {}) => ({
            hotelId: new mongoose.Types.ObjectId(hotelId),
            ...additionalFilters,
        }),

        validate: async <T extends { hotelId: mongoose.Types.ObjectId }>(
            document: T | null
        ): Promise<boolean> => {
            return validateTenantAccess(document, hotelId);
        },
    };
}

/**
 * Sanitize query to prevent hotelId manipulation
 * Removes any hotelId from user input to prevent tenant bypass
 */
export function sanitizeQuery(
    query: Record<string, any>,
    allowedFields: string[]
): Record<string, any> {
    const sanitized: Record<string, any> = {};

    for (const field of allowedFields) {
        if (field !== 'hotelId' && query[field] !== undefined) {
            sanitized[field] = query[field];
        }
    }

    return sanitized;
}

/**
 * Error class for tenant access violations
 */
export class TenantAccessError extends Error {
    constructor(message = 'غير مصرح لك بالوصول إلى هذه البيانات') {
        super(message);
        this.name = 'TenantAccessError';
    }
}
