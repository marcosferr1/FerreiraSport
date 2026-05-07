const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const authRoutes = require('./routes/auth.routes');
const customersRoutes = require('./routes/customers.routes');
const vehiclesRoutes = require('./routes/vehicles.routes');
const intakesRoutes = require('./routes/intakes.routes');
const budgetsRoutes = require('./routes/budgets.routes');
const paymentsRoutes = require('./routes/payments.routes');
const vehicleCatalogRoutes = require('./routes/vehicle-catalog.routes');
const serviceCatalogRoutes = require('./routes/service-catalog.routes');
const partCatalogRoutes = require('./routes/part-catalog.routes');
const servicesRoutes = require('./routes/services.routes');

const { requireAuth } = require('./middleware/auth');

require('dotenv').config();

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/auth', authRoutes);

// Rutas protegidas (para MVP, todo lo demás requiere auth).
app.use(requireAuth);
app.use('/customers', customersRoutes);
app.use('/vehicles', vehiclesRoutes);
app.use('/vehicle-brands', vehicleCatalogRoutes);
app.use('/service-catalogs', serviceCatalogRoutes);
app.use('/part-catalogs', partCatalogRoutes);
app.use('/services', servicesRoutes);
app.use('/intakes', intakesRoutes);
app.use('/budgets', budgetsRoutes);
app.use('/payments', paymentsRoutes);

// 404
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error(err);
  const status = err.statusCode || 500;
  res.status(status).json({ error: err.message || 'Internal error' });
});

module.exports = app;

