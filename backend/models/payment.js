'use strict';

module.exports = (sequelize, DataTypes) => {
  const Payment = sequelize.define(
    'Payment',
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      method: { type: DataTypes.STRING, allowNull: false },
      paidAt: { type: DataTypes.DATE, allowNull: false },

      customerId: { type: DataTypes.UUID, allowNull: true },
      vehicleId: { type: DataTypes.UUID, allowNull: true },
      intakeId: { type: DataTypes.UUID, allowNull: true },
      budgetId: { type: DataTypes.UUID, allowNull: true },

      note: { type: DataTypes.TEXT, allowNull: true },
      reference: { type: DataTypes.STRING, allowNull: true },

      createdBy: { type: DataTypes.UUID, allowNull: true },
    },
    { tableName: 'payments' }
  );

  Payment.associate = (models) => {
    Payment.belongsTo(models.Budget, { foreignKey: 'budgetId' });
  };

  return Payment;
};

