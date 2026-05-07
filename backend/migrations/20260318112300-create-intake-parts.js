'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('intake_parts', {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
      intake_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'intakes', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      part_catalog_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'part_catalogs', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      name_snapshot: { type: Sequelize.STRING, allowNull: false },
      qty: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 1 },
      unit_price: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      line_total: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      notes: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    await queryInterface.addIndex('intake_parts', ['intake_id'], { name: 'intake_parts_intake_id_idx' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('intake_parts');
  },
};
