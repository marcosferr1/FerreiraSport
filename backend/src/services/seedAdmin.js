const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../../models');

const User = db.User;

function getRequiredEnv(name) {
  return process.env[name] && process.env[name].trim() ? process.env[name].trim() : null;
}

async function seedAdmin({ autoSeed = true } = {}) {
  if (!autoSeed) return;

  const email = getRequiredEnv('ADMIN_EMAIL');
  const password = getRequiredEnv('ADMIN_PASSWORD');

  if (!email || !password) {
    // eslint-disable-next-line no-console
    console.warn('[seedAdmin] ADMIN_EMAIL/ADMIN_PASSWORD no definidos. Saltando seed.');
    return;
  }

  const existing = await User.findOne({ where: { email } });
  if (existing) return;

  const passwordHash = await bcrypt.hash(password, 10);
  const id = crypto.randomUUID();

  await User.create({
    id,
    email,
    passwordHash,
    role: 'ADMIN',
  });

  // eslint-disable-next-line no-console
  console.log('[seedAdmin] Admin creado desde seed.');
}

module.exports = seedAdmin;

