'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('part_catalogs', {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
      name: { type: Sequelize.STRING, allowNull: false },
      brand: { type: Sequelize.STRING, allowNull: true },
      sku: { type: Sequelize.STRING, allowNull: true },
      description: { type: Sequelize.TEXT, allowNull: true },
      suggested_price: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
      active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    await queryInterface.addConstraint('part_catalogs', {
      fields: ['name', 'brand', 'sku'],
      type: 'unique',
      name: 'part_catalogs_name_brand_sku_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('part_catalogs');
  },
};
