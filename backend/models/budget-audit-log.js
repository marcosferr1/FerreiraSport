'use strict';

module.exports = (sequelize, DataTypes) => {
  const BudgetAuditLog = sequelize.define(
    'BudgetAuditLog',
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      budgetId: { type: DataTypes.UUID, allowNull: false },
      eventType: { type: DataTypes.STRING, allowNull: false },
      fromStatus: { type: DataTypes.STRING, allowNull: true },
      toStatus: { type: DataTypes.STRING, allowNull: true },
      changedBy: { type: DataTypes.UUID, allowNull: true },
      payload: { type: DataTypes.JSONB, allowNull: true },
      changedAt: { type: DataTypes.DATE, allowNull: false },
    },
    { tableName: 'budget_audit_logs', timestamps: false }
  );

  return BudgetAuditLog;
};

