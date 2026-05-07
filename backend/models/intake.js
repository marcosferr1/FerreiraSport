'use strict';

module.exports = (sequelize, DataTypes) => {
  const Intake = sequelize.define(
    'Intake',
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      vehicleId: { type: DataTypes.UUID, allowNull: true },
      customerId: { type: DataTypes.UUID, allowNull: true },
      status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'OPEN' },
      receivedAt: { type: DataTypes.DATE, allowNull: false },
      odometer: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
      createdBy: { type: DataTypes.UUID, allowNull: true },
    },
    { tableName: 'intakes' }
  );

  Intake.associate = (models) => {
    Intake.belongsTo(models.Vehicle, { foreignKey: 'vehicleId' });
    Intake.belongsTo(models.Customer, { foreignKey: 'customerId' });
    Intake.hasMany(models.ClinicalRecord, { foreignKey: 'intakeId' });
    Intake.hasMany(models.IntakeService, { foreignKey: 'intakeId' });
    Intake.hasMany(models.IntakePart, { foreignKey: 'intakeId' });
  };

  return Intake;
};

