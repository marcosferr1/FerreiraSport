'use strict';

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    'User',
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      email: { type: DataTypes.STRING, allowNull: false, unique: true },
      passwordHash: { type: DataTypes.STRING, allowNull: false },
      role: { type: DataTypes.STRING, allowNull: false }, // ADMIN | OPERADOR
    },
    {
      tableName: 'users',
    }
  );

  User.associate = (models) => {
    // Asociaciones opcionales (principalmente para incluir datos).
    User.hasMany(models.BudgetAuditLog, { foreignKey: 'changedBy' });
    User.hasMany(models.Payment, { foreignKey: 'createdBy' });
  };

  return User;
};

