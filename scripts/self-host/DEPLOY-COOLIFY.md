# Despliegue de TuStore en Coolify

Este procedimiento crea una aplicación independiente de TuStore. No reutiliza
la aplicación, base de datos, Storage, Auth, túnel ni workers de ICB.

## 1. Crear la aplicación

1. En Coolify crea un recurso nuevo de tipo **Application**.
2. Conecta el repositorio que contiene esta carpeta y selecciona la rama de
   producción.
3. Usa `Dockerfile` como método de build y conserva el puerto interno `3000`.
4. Configura el healthcheck en `/api/health`.
5. Asigna primero un hostname temporal para probar antes de tocar el dominio
   público.

Si se despliega directamente con Docker Compose, usa el `docker-compose.yml`
de la raíz y coloca el archivo `.env` en el servidor (nunca lo subas al repo).

## 2. Variables mínimas

En Coolify define estas variables en la aplicación de TuStore:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `NEXT_PUBLIC_SITE_URL` (hostname temporal durante QA)
- `NEXT_PUBLIC_SITE_ORIGIN` (mismo origen sin rutas)
- `TUSTORE_EXTERNAL_EFFECTS_ENABLED=false`

Para habilitar la analítica CPI propia de TuStore también se requieren:

- `CPI_BASE_URL`
- `CPI_USER`
- `CPI_PASS`
- `CPI_ID`
- `TUSTORE_SYNC_TARGET_ORIGIN=https://api.tustorecr.com`
- `TUSTORE_CPI_ENABLED=true`

Los filtros `CPI_ACTIVITY_CODES`, `CPI_TAX_TYPES` y
`CPI_INVENTORY_BRANCHES` son opcionales y deben corresponder a la cuenta CPI de
TuStore, no a ICB.

Las variables `NEXT_PUBLIC_*` deben estar disponibles durante el build porque
Next.js las incorpora al bundle. Las claves privadas deben permanecer solo en
runtime. El worker CPI usa `/etc/tustore/runtime.env`, separado de las variables
y servicios de ICB.

## 3. Activar el worker CPI

Después de validar las credenciales con una ejecución manual:

```bash
docker build --target cpi-worker -t tustore-cpi:local .
sudo install -m 0755 scripts/self-host/tustore-host-job.sh /opt/tustore-ops/tustore-host-job.sh
sudo install -m 0644 scripts/self-host/tustore-cpi.service scripts/self-host/tustore-cpi.timer \
  scripts/self-host/tustore-cpi-full.service scripts/self-host/tustore-cpi-full.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl start tustore-cpi.service
sudo systemctl enable --now tustore-cpi.timer tustore-cpi-full.timer
```

La sincronización incremental cubre tres días cada 30 minutos; la nocturna
reconcilia 31 días. Ambas escriben exclusivamente en el Supabase autorizado por
`TUSTORE_SYNC_TARGET_ORIGIN`.

## 4. Verificación antes del dominio

Desde el servidor o desde la red local:

```bash
curl -fsS https://HOST_TEMPORAL/api/health
node scripts/self-host/check-runtime.mjs
```

La respuesta del healthcheck debe ser `200`. Después se revisan portada,
búsqueda, catálogo, detalle, carrito y checkout con efectos externos todavía
deshabilitados.

## 5. Cambio de dominio

Cuando QA termine, configura el dominio en Coolify, actualiza
`NEXT_PUBLIC_SITE_URL` y `NEXT_PUBLIC_SITE_ORIGIN`, espera el certificado TLS y
comprueba redirecciones, sitemap y checkout. El DNS se cambia al final; no se
debe apuntar el dominio mientras el hostname temporal no esté validado.

Los artefactos históricos con prefijo `icb-` no forman parte de este despliegue
y no deben activarse.
