'use strict';

const bcrypt = require('bcryptjs');

function getRequiredEnv(name) {
  return process.env[name] && process.env[name].trim() ? process.env[name].trim() : null;
}

module.exports = {
  async up(queryInterface) {
    const email = getRequiredEnv('ADMIN_EMAIL');
    const password = getRequiredEnv('ADMIN_PASSWORD');

    if (!email || !password) {
      // No forzamos seed si no están las variables (útil para desarrollo).
      return;
    }

    const [existing] = await queryInterface.sequelize.query(
      'SELECT id FROM users WHERE email = $1 LIMIT 1',
      { bind: [email], type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    if (existing) return;

    const passwordHash = await bcrypt.hash(password, 10);
    const id = require('crypto').randomUUID();

    await queryInterface.bulkInsert('users', [
      {
        id,
        email,
        password_hash: passwordHash,
        role: 'ADMIN',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  },

  async down() {
    // No eliminamos admins por seguridad (down suele usarse para rollback manual).
    return;
  },
};

