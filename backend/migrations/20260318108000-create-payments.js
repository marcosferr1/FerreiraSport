'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('payments', {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
      amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
      method: { type: Sequelize.STRING, allowNull: false },
      paid_at: { type: Sequelize.DATE, allowNull: false },

      customer_id: { type: Sequelize.UUID, allowNull: true },
      vehicle_id: { type: Sequelize.UUID, allowNull: true },
      intake_id: { type: Sequelize.UUID, allowNull: true },
      budget_id: { type: Sequelize.UUID, allowNull: true },

      note: { type: Sequelize.TEXT, allowNull: true },
      reference: { type: Sequelize.STRING, allowNull: true },

      created_by: { type: Sequelize.UUID, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('payments');
  },
};

