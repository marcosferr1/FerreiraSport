'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('budget_lines', {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
      budget_id: { type: Sequelize.UUID, allowNull: false },
      description: { type: Sequelize.STRING, allowNull: false },
      qty: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 1 },
      unit_price: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      line_total: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('budget_lines');
  },
};

