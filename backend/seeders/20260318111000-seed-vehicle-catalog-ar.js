'use strict';

const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { QueryTypes } = require('sequelize');

const CATALOG_PATH = path.join(__dirname, '..', 'data', 'vehicle-catalog-ar.json');

module.exports = {
  async up(queryInterface) {
    const raw = fs.readFileSync(CATALOG_PATH, 'utf8');
    const brandsAndModels = JSON.parse(raw);
    const now = new Date();
    const sequelize = queryInterface.sequelize;

    for (const [brandName, models] of Object.entries(brandsAndModels)) {
      const brandRows = await sequelize.query('SELECT id FROM vehicle_brands WHERE name = $1 LIMIT 1', {
        bind: [brandName],
        type: QueryTypes.SELECT,
      });

      let brandId = brandRows[0]?.id;
      if (!brandId) {
        brandId = randomUUID();
        await queryInterface.bulkInsert('vehicle_brands', [
          { id: brandId, name: brandName, created_at: now, updated_at: now },
        ]);
      }

      for (const modelName of models) {
        const modelRows = await sequelize.query(
          'SELECT id FROM vehicle_models WHERE vehicle_brand_id = $1 AND name = $2 LIMIT 1',
          { bind: [brandId, modelName], type: QueryTypes.SELECT }
        );
        if (modelRows.length) continue;

        await queryInterface.bulkInsert('vehicle_models', [
          {
            id: randomUUID(),
            vehicle_brand_id: brandId,
            name: modelName,
            created_at: now,
            updated_at: now,
          },
        ]);
      }
    }
  },

  async down() {
    // No eliminamos el catálogo en down (datos de referencia).
  },
};
