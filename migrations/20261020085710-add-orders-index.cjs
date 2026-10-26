module.exports = {
  /**
   * Creates a compound index on the orders collection to speed up lookups
   * filtered by productId and status.
   * @param {import('mongodb').Db} db
   */
  async up(db) {
    await db.collection('orders').createIndex(
      { productId: 1, status: 1 },
      { name: 'orders_productId_status_idx' },
    );
  },

  /**
   * Rolls back the index created by `up`.
   * @param {import('mongodb').Db} db
   */
  async down(db) {
    await db.collection('orders').dropIndex('orders_productId_status_idx');
  },
};
