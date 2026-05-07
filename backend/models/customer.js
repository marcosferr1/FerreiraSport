'use strict';

module.exports = (sequelize, DataTypes) => {
  const Customer = sequelize.define(
    'Customer',
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      type: { type: DataTypes.STRING, allowNull: true }, // PARTICULAR | EMPRESA
      name: { type: DataTypes.STRING, allowNull: true },
      phone: { type: DataTypes.STRING, allowNull: true },
      email: { type: DataTypes.STRING, allowNull: true },
      doc: { type: DataTypes.STRING, allowNull: true },
    },
    { tableName: 'customers' }
  );

  return Customer;
};

