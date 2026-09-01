# TuStore Costa Rica

Aplicación de tienda construida con Next.js. Esta carpeta es un proyecto
independiente de ICB y conserva módulos futuros (CPI, colaboradores,
vendedores y automatizaciones) que no son necesarios para la tienda actual.

## Desarrollo local

```bash
npm ci
npm run dev
```

Abrir <http://localhost:3000>.

## Producción

La imagen de producción se construye con el `Dockerfile` raíz y ejecuta
Next.js standalone en el puerto `3000`. Coolify debe crear una aplicación
separada para TuStore, con sus propias variables, base Supabase, Auth,
Storage, healthcheck y hostname temporal.

Las variables `NEXT_PUBLIC_*` se necesitan durante `next build`; las claves
privadas se configuran solo en ejecución. Usar
`TUSTORE_EXTERNAL_EFFECTS_ENABLED=false` durante las pruebas.

`TUSTORE_STORE_API_URL` solo se define si se desea consultar WordPress durante
una transición. Si queda vacío, el catálogo usa el snapshot local hasta que se
complete la fuente de datos Supabase.

La operación del servidor está documentada en
`scripts/self-host/README.md`. No ejecutar los artefactos históricos con
prefijo `icb-`.

Para el procedimiento paso a paso en Coolify, consulta
`scripts/self-host/DEPLOY-COOLIFY.md`. También hay un `docker-compose.yml`
para ejecutar únicamente la web de TuStore en un host Docker.
