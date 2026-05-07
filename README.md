# Taller — proyecto

## Desarrollo con Docker (hot reload, sin rebuild al editar)

Requiere `.env` en la raíz (ver `.env.example`).

```bash
docker compose -f docker-compose.dev.yml up --build
```

- **Frontend (Vite):** http://localhost:5173 — código montado desde `./frontend`
- **Backend (nodemon):** http://localhost:4000 — código montado desde `./backend`
- **Postgres:** datos en volumen `postgres_data_dev`. En el host suele publicarse en **5433** (`DB_PUBLISH_PORT` en `.env`) para no pisar un Postgres local en 5432.

Los `node_modules` van en volúmenes Docker (`backend_node_modules`, `frontend_node_modules`) para no pisar dependencias al montar el código. La primera subida puede tardar (`npm ci` en el entrypoint).

Migraciones se ejecutan al arrancar el backend. Seeds: `docker compose -f docker-compose.dev.yml exec backend npm run seed`

Detener: `Ctrl+C` o `docker compose -f docker-compose.dev.yml down`

### Error: `password authentication failed for user "taller_user"`

Postgres guarda usuario/clave **solo la primera vez** que crea el volumen. Si cambiaste `DB_PASSWORD` en `.env`, la base vieja sigue con la contraseña anterior.

**Solución (borra datos de la DB en Docker):**

```bash
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml up --build
```

`-v` elimina el volumen `postgres_data_dev` y Postgres se crea de nuevo con el `DB_PASSWORD` actual del `.env`.

## Producción (imagen build + nginx en front)

```bash
docker compose up --build -d
```

Usa `docker-compose.yml` “clásico”: front servido como estático en el puerto 5173 del host.
