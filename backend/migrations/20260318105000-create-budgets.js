'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('budgets', {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
      customer_id: { type: Sequelize.UUID, allowNull: true },
      vehicle_id: { type: Sequelize.UUID, allowNull: true },
      intake_id: { type: Sequelize.UUID, allowNull: true },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'PENDIENTE',
      },
      replaces_budget_id: { type: Sequelize.UUID, allowNull: true },
      created_by: { type: Sequelize.UUID, allowNull: true },
      updated_by: { type: Sequelize.UUID, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('budgets');
  },
};

