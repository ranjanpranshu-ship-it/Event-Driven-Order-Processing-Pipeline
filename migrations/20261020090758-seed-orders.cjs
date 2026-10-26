module.exports = {
  async up(db) {
    const orders = [];
    for (let i = 1; i <= 50; i++) {
      orders.push({
        productId: `prod-${i % 10}`,
        quantity: (i % 5) + 1,
        status: ['pending', 'confirmed', 'shipped', 'delivered'][i % 4],
        createdAt: new Date(Date.now() - i * 86_400_000),
      });
    }
    await db.collection('orders').insertMany(orders);
  },

  async down(db) {
    await db
      .collection('orders')
      .deleteMany({ productId: { $regex: /^prod-/ } });
  },
};
