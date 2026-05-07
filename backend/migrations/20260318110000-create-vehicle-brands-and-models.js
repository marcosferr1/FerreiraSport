'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('vehicle_brands', {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
      name: { type: Sequelize.STRING, allowNull: false, unique: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    await queryInterface.createTable('vehicle_models', {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
      vehicle_brand_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'vehicle_brands', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      name: { type: Sequelize.STRING, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    await queryInterface.addConstraint('vehicle_models', {
      fields: ['vehicle_brand_id', 'name'],
      type: 'unique',
      name: 'vehicle_models_brand_id_name_unique',
    });

    await queryInterface.addIndex('vehicle_models', ['vehicle_brand_id'], {
      name: 'vehicle_models_vehicle_brand_id_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('vehicle_models');
    await queryInterface.dropTable('vehicle_brands');
  },
};
