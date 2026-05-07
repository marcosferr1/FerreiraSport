'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('budget_audit_logs', {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
      budget_id: { type: Sequelize.UUID, allowNull: false },
      event_type: { type: Sequelize.STRING, allowNull: false },
      from_status: { type: Sequelize.STRING, allowNull: true },
      to_status: { type: Sequelize.STRING, allowNull: true },
      changed_by: { type: Sequelize.UUID, allowNull: true },
      changed_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      payload: { type: Sequelize.JSONB, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('budget_audit_logs');
  },
};

