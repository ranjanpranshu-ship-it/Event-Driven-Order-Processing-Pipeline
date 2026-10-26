export const ORDERS_CACHE_KEY = 'orders:all';

export const orderCacheKey = (orderId: string) => `order:${orderId}`;

export const CACHE_TTL_MS = 30_000;
