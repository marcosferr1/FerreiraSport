'use strict';

module.exports = (sequelize, DataTypes) => {
  const IntakeService = sequelize.define(
    'IntakeService',
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      intakeId: { type: DataTypes.UUID, allowNull: false },
      serviceCatalogId: { type: DataTypes.UUID, allowNull: true },
      nameSnapshot: { type: DataTypes.STRING, allowNull: false },
      laborPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      notes: { type: DataTypes.TEXT, allowNull: true },
    },
    { tableName: 'intake_services' }
  );

  IntakeService.associate = (models) => {
    IntakeService.belongsTo(models.Intake, { foreignKey: 'intakeId' });
    IntakeService.belongsTo(models.ServiceCatalog, { foreignKey: 'serviceCatalogId' });
  };

  return IntakeService;
};
