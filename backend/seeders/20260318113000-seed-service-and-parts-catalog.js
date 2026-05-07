'use strict';

const { randomUUID } = require('crypto');

const SERVICE_CATALOG = [
  { name: 'Service completo', suggestedPrice: 180000 },
  { name: 'Cambio de aceite y filtro', suggestedPrice: 90000 },
  { name: 'Cambio de filtro de aire', suggestedPrice: 25000 },
  { name: 'Cambio de filtro de combustible', suggestedPrice: 30000 },
  { name: 'Cambio de pastillas de freno', suggestedPrice: 120000 },
  { name: 'Cambio de discos de freno', suggestedPrice: 180000 },
  { name: 'Cambio de correa de distribución', suggestedPrice: 260000 },
  { name: 'Alineación y balanceo', suggestedPrice: 40000 },
];

const PART_CATALOG = [
  { name: 'Aceite 5W30 1L', brand: 'Genérico', suggestedPrice: 12000 },
  { name: 'Filtro de aceite', brand: 'Genérico', suggestedPrice: 15000 },
  { name: 'Filtro de aire', brand: 'Genérico', suggestedPrice: 18000 },
  { name: 'Filtro de combustible', brand: 'Genérico', suggestedPrice: 24000 },
  { name: 'Pastillas de freno delanteras', brand: 'Genérico', suggestedPrice: 65000 },
  { name: 'Disco de freno delantero', brand: 'Genérico', suggestedPrice: 52000 },
  { name: 'Correa de distribución', brand: 'Genérico', suggestedPrice: 85000 },
  { name: 'Tensor de distribución', brand: 'Genérico', suggestedPrice: 55000 },
  { name: 'Bomba de agua', brand: 'Genérico', suggestedPrice: 78000 },
  { name: 'Líquido refrigerante 1L', brand: 'Genérico', suggestedPrice: 9000 },
  { name: 'Bujía', brand: 'Genérico', suggestedPrice: 7000 },
  { name: 'Líquido de frenos DOT4', brand: 'Genérico', suggestedPrice: 12000 },
];

module.exports = {
  async up(queryInterface) {
    const sequelize = queryInterface.sequelize;
    const now = new Date();

    for (const item of SERVICE_CATALOG) {
      const rows = await sequelize.query('SELECT id FROM service_catalogs WHERE name = $1 LIMIT 1', {
        bind: [item.name],
        type: sequelize.constructor.QueryTypes.SELECT,
      });
      if (rows.length) continue;
      await queryInterface.bulkInsert('service_catalogs', [
        {
          id: randomUUID(),
          name: item.name,
          description: null,
          suggested_price: item.suggestedPrice,
          active: true,
          created_at: now,
          updated_at: now,
        },
      ]);
    }

    for (const item of PART_CATALOG) {
      const rows = await sequelize.query(
        'SELECT id FROM part_catalogs WHERE name = $1 AND brand IS NOT DISTINCT FROM $2 AND sku IS NULL LIMIT 1',
        {
          bind: [item.name, item.brand || null],
          type: sequelize.constructor.QueryTypes.SELECT,
        }
      );
      if (rows.length) continue;
      await queryInterface.bulkInsert('part_catalogs', [
        {
          id: randomUUID(),
          name: item.name,
          brand: item.brand || null,
          sku: null,
          description: null,
          suggested_price: item.suggestedPrice,
          active: true,
          created_at: now,
          updated_at: now,
        },
      ]);
    }
  },

  async down() {
    return;
  },
};
