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
Storage, Auth, roles y credenciales completamente aislados de ICB. Migrar solo
las tablas de catálogo, pedidos y configuración de TuStore. Las tablas CPI,
empleados, vendedores, MercadoLibre y push son módulos futuros de TuStore y no
deben compartir datos con ICB.

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

Los archivos con prefijo `icb-` que permanecen en esta carpeta son artefactos
históricos de la preparación de ICB y no forman parte de este procedimiento.
No deben instalarse ni ejecutarse para TuStore.
