'use strict';

module.exports = (sequelize, DataTypes) => {
  const BudgetLine = sequelize.define(
    'BudgetLine',
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      budgetId: { type: DataTypes.UUID, allowNull: false },
      description: { type: DataTypes.STRING, allowNull: false },
      qty: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 1 },
      unitPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      lineTotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    },
    { tableName: 'budget_lines' }
  );

  BudgetLine.associate = (models) => {
    BudgetLine.belongsTo(models.Budget, { foreignKey: 'budgetId' });
  };

  return BudgetLine;
};

