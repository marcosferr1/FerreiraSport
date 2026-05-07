'use strict';

module.exports = (sequelize, DataTypes) => {
  const PartCatalog = sequelize.define(
    'PartCatalog',
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      name: { type: DataTypes.STRING, allowNull: false },
      brand: { type: DataTypes.STRING, allowNull: true },
      sku: { type: DataTypes.STRING, allowNull: true },
      description: { type: DataTypes.TEXT, allowNull: true },
      suggestedPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    { tableName: 'part_catalogs' }
  );

  PartCatalog.associate = (models) => {
    PartCatalog.hasMany(models.IntakePart, { foreignKey: 'partCatalogId' });
  };

  return PartCatalog;
};
