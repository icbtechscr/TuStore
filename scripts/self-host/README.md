# Operación de TuStore en servidor propio

Esta guía pertenece exclusivamente a TuStore. La aplicación, Supabase,
Storage, Auth, Coolify y Cloudflare de TuStore deben usar recursos y secretos
propios. No ejecutar unidades, scripts ni comandos de la aplicación ICB desde
este proyecto.

## Estado actual

- La aplicación web se construye con el `Dockerfile` raíz y escucha en el
  puerto `3000`.
- El healthcheck consulta `/api/health` en `127.0.0.1:3000`.
- El despliegue debe ser una aplicación separada en Coolify, con un hostname
  temporal antes de cambiar el dominio público.
- La IP del servidor y el hostname final aún deben verificarse en Ubuntu; no
  asumir valores de documentos históricos.

## Aislamiento de datos

Usar un proyecto/instancia de Supabase de TuStore, o como mínimo una base,
Storage, Auth, roles y credenciales completamente aislados de ICB. La analítica
CPI de TuStore usa sus propias tablas, vendedores, sucursales y credenciales;
nunca debe apuntar a la base ni a la cuenta CPI de ICB.

Los respaldos deben guardarse fuera del repositorio, con permisos privados,
SHA-256 y una copia externa verificable. Nunca subir respaldos, dumps o
variables de entorno a Git.

## Variables y efectos externos

Las variables `NEXT_PUBLIC_*` que se usan en el cliente deben estar configuradas
como variables de compilación en Coolify. Las claves privadas son únicamente
variables de ejecución. Mantener
`TUSTORE_EXTERNAL_EFFECTS_ENABLED=false` durante las pruebas para bloquear
pagos, correos y notificaciones.

La URL de WordPress (`TUSTORE_STORE_API_URL`) es opcional y solo debe definirse
durante una transición controlada. Vacía, la aplicación usa el snapshot local.

## Orden de despliegue

1. Crear el repositorio y la aplicación Coolify exclusivos de TuStore.
2. Configurar el Supabase/Storage/Auth aislado y verificar respaldos.
3. Construir la imagen y probar el healthcheck con una URL temporal.
4. Validar catálogo, imágenes, Auth, carrito, pedidos y pagos de prueba.
5. Configurar una ruta Cloudflare independiente para TuStore.
6. Cambiar el DNS solo después de comparar datos y conservar el hosting
   anterior para rollback.

## Analítica CPI de TuStore

El panel ya incluye rotación de inventario, ventas por sucursal, desempeño de
vendedores, cotizaciones e inventario CPI. Para alimentarlo:

1. Ejecutar los archivos `supabase/cpi_*.sql` en la base exclusiva de TuStore.
2. Crear `/etc/tustore/runtime.env` con permisos `0600` y las variables
   `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `CPI_BASE_URL`,
   `CPI_USER`, `CPI_PASS`, `CPI_ID`, `TUSTORE_SYNC_TARGET_ORIGIN` y
   `TUSTORE_CPI_ENABLED=true`.
3. Construir el target `cpi-worker` como `tustore-cpi:local`.
4. Instalar `tustore-host-job.sh` en `/opt/tustore-ops/` y las unidades
   `tustore-cpi*.service`/`tustore-cpi*.timer` en systemd.
5. Ejecutar primero `tustore-cpi.service` manualmente y verificar los conteos
   antes de habilitar los timers.

`CPI_INVENTORY_BRANCHES` es opcional. Si está vacío, el sincronizador descubre
las sucursales visibles en la cuenta CPI de TuStore; si CPI no publica el
selector, sincroniza el inventario general sin reutilizar la lista de ICB.

Los archivos con prefijo `icb-` que permanecen en esta carpeta son artefactos
históricos de la preparación de ICB y no forman parte de este procedimiento.
No deben instalarse ni ejecutarse para TuStore.
