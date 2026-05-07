'use strict';

module.exports = (sequelize, DataTypes) => {
  const VehicleModel = sequelize.define(
    'VehicleModel',
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      name: { type: DataTypes.STRING, allowNull: false },
      vehicleBrandId: { type: DataTypes.UUID, allowNull: false },
    },
    { tableName: 'vehicle_models' }
  );

  VehicleModel.associate = (models) => {
    VehicleModel.belongsTo(models.VehicleBrand, { foreignKey: 'vehicleBrandId', as: 'brand' });
  };

  return VehicleModel;
};
