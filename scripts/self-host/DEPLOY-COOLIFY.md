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

Las variables `NEXT_PUBLIC_*` deben estar disponibles durante el build porque
Next.js las incorpora al bundle. Las claves privadas deben permanecer solo en
runtime. CPI, empleados, vendedores y sincronizaciones quedan sin configurar
hasta que se habiliten como módulos propios de TuStore.

## 3. Verificación antes del dominio

Desde el servidor o desde la red local:

```bash
curl -fsS https://HOST_TEMPORAL/api/health
node scripts/self-host/check-runtime.mjs
```

La respuesta del healthcheck debe ser `200`. Después se revisan portada,
búsqueda, catálogo, detalle, carrito y checkout con efectos externos todavía
deshabilitados.

## 4. Cambio de dominio

Cuando QA termine, configura el dominio en Coolify, actualiza
`NEXT_PUBLIC_SITE_URL` y `NEXT_PUBLIC_SITE_ORIGIN`, espera el certificado TLS y
comprueba redirecciones, sitemap y checkout. El DNS se cambia al final; no se
debe apuntar el dominio mientras el hostname temporal no esté validado.

Los artefactos históricos con prefijo `icb-` no forman parte de este despliegue
y no deben activarse.
