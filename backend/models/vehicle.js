'use strict';

module.exports = (sequelize, DataTypes) => {
  const Vehicle = sequelize.define(
    'Vehicle',
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      plate: { type: DataTypes.STRING, allowNull: false, unique: true },
      make: { type: DataTypes.STRING, allowNull: true },
      model: { type: DataTypes.STRING, allowNull: true },
      year: { type: DataTypes.INTEGER, allowNull: true },
      customerId: { type: DataTypes.UUID, allowNull: true },
    },
    { tableName: 'vehicles' }
  );

  Vehicle.associate = (models) => {
    Vehicle.belongsTo(models.Customer, { foreignKey: 'customerId' });
  };

  return Vehicle;
};

