'use strict';

module.exports = (sequelize, DataTypes) => {
  const VehicleBrand = sequelize.define(
    'VehicleBrand',
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      name: { type: DataTypes.STRING, allowNull: false, unique: true },
    },
    { tableName: 'vehicle_brands' }
  );

  VehicleBrand.associate = (models) => {
    VehicleBrand.hasMany(models.VehicleModel, { foreignKey: 'vehicleBrandId', as: 'models' });
  };

  return VehicleBrand;
};
