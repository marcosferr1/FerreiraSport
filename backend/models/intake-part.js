'use strict';

module.exports = (sequelize, DataTypes) => {
  const IntakePart = sequelize.define(
    'IntakePart',
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      intakeId: { type: DataTypes.UUID, allowNull: false },
      partCatalogId: { type: DataTypes.UUID, allowNull: true },
      nameSnapshot: { type: DataTypes.STRING, allowNull: false },
      qty: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 1 },
      unitPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      lineTotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      notes: { type: DataTypes.TEXT, allowNull: true },
    },
    { tableName: 'intake_parts' }
  );

  IntakePart.associate = (models) => {
    IntakePart.belongsTo(models.Intake, { foreignKey: 'intakeId' });
    IntakePart.belongsTo(models.PartCatalog, { foreignKey: 'partCatalogId' });
  };

  return IntakePart;
};
