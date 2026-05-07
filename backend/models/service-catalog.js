'use strict';

module.exports = (sequelize, DataTypes) => {
  const ServiceCatalog = sequelize.define(
    'ServiceCatalog',
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      name: { type: DataTypes.STRING, allowNull: false, unique: true },
      description: { type: DataTypes.TEXT, allowNull: true },
      suggestedPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    { tableName: 'service_catalogs' }
  );

  ServiceCatalog.associate = (models) => {
    ServiceCatalog.hasMany(models.IntakeService, { foreignKey: 'serviceCatalogId' });
  };

  return ServiceCatalog;
};
