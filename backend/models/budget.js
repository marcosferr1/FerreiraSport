'use strict';

module.exports = (sequelize, DataTypes) => {
  const Budget = sequelize.define(
    'Budget',
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      customerId: { type: DataTypes.UUID, allowNull: true },
      vehicleId: { type: DataTypes.UUID, allowNull: true },
      intakeId: { type: DataTypes.UUID, allowNull: true },
      status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'PENDIENTE' },
      replacesBudgetId: { type: DataTypes.UUID, allowNull: true },
      createdBy: { type: DataTypes.UUID, allowNull: true },
      updatedBy: { type: DataTypes.UUID, allowNull: true },
    },
    { tableName: 'budgets' }
  );

  Budget.associate = (models) => {
    Budget.hasMany(models.BudgetLine, { foreignKey: 'budgetId' });
    Budget.hasMany(models.BudgetAuditLog, { foreignKey: 'budgetId' });
  };

  return Budget;
};

