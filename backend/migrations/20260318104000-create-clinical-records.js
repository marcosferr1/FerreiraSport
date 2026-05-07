'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('clinical_records', {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
      intake_id: { type: Sequelize.UUID, allowNull: false },
      complaint: { type: Sequelize.TEXT, allowNull: true },
      diagnosis: { type: Sequelize.TEXT, allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      created_by: { type: Sequelize.UUID, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('clinical_records');
  },
};

