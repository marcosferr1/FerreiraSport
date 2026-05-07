'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('intakes', {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
      vehicle_id: { type: Sequelize.UUID, allowNull: true },
      customer_id: { type: Sequelize.UUID, allowNull: true },
      status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'OPEN' },
      received_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      odometer: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      created_by: { type: Sequelize.UUID, allowNull: true },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('intakes');
  },
};

