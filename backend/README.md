# Backend (API)

## Docker (desarrollo)

Desde la raíz del repo: `docker compose -f docker-compose.dev.yml up --build` — el código se monta en volumen; ver [README en la raíz](../README.md).

## Base de datos (Sequelize)

Definí `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT` en un `.env` (ver `.env.example` en la raíz del proyecto). Para migraciones y seeds desde tu máquina con Postgres en local o el puerto mapeado de Docker, usá `DB_HOST=127.0.0.1`.

```bash
cd backend
npm install
npm run migrate
npm run seed
```

- **Migraciones**: `migrations/`
- **Seeders**: `seeders/` (incluye admin si `ADMIN_EMAIL` / `ADMIN_PASSWORD` están definidos, y catálogo de marcas/modelos AR)
- **Catálogo vehículos Argentina**: datos editables en [`data/vehicle-catalog-ar.json`](data/vehicle-catalog-ar.json) (marcas → lista de modelos). El seeder es idempotente: podés volver a ejecutar `npm run seed` sin duplicar filas.

El archivo [`.sequelizerc`](.sequelizerc) apunta a `config/config.js` y a las carpetas de migraciones/seeders.
