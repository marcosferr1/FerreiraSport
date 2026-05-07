'use strict';

module.exports = (sequelize, DataTypes) => {
  const ClinicalRecord = sequelize.define(
    'ClinicalRecord',
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      intakeId: { type: DataTypes.UUID, allowNull: false },
      complaint: { type: DataTypes.TEXT, allowNull: true },
      diagnosis: { type: DataTypes.TEXT, allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
      createdBy: { type: DataTypes.UUID, allowNull: true },
    },
    { tableName: 'clinical_records' }
  );

  ClinicalRecord.associate = (models) => {
    ClinicalRecord.belongsTo(models.Intake, { foreignKey: 'intakeId' });
  };

  return ClinicalRecord;
};

