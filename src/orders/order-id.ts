import { ObjectId } from 'mongodb';

/**
 * MongoDB order ids are ObjectIds. Guard against malformed ids so the
 * database layer does not throw a BSONError (which would surface as a 500).
 */
export const isValidOrderId = (orderId: string): boolean =>
  typeof orderId === 'string' && ObjectId.isValid(orderId);
