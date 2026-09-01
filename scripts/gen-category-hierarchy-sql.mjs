// Genera supabase/categories_hierarchy.sql a partir de data/categories.json
// (export legado de WooCommerce). Reconstruye la jerarquía padre/hijo en la
// tabla `categories` de Supabase usando el `woo_id` que ya tiene cada fila.
//
// Uso: node scripts/gen-category-hierarchy-sql.mjs
import { readFileSync, writeFileSync } from "node:fs";

const cats = JSON.parse(
  readFileSync("./data/categories.json", "utf8").replace(/^﻿/, "")
);

// Pares hijo→padre (solo los que tienen padre real, parent !== 0).
const pairs = cats
  .filter((c) => Number(c.parent) > 0)
  .map((c) => [Number(c.id), Number(c.parent)]);

const valuesSql = pairs
  .map(([child, parent]) => `    (${child}, ${parent})`)
  .join(",\n");

const sql = `-- Jerarquía de categorías (Categoría → Subcategoría)
-- Generado por scripts/gen-category-hierarchy-sql.mjs desde data/categories.json.
-- Idempotente: se puede correr varias veces sin romper nada.
--
-- Las ${cats.length} categorías ya existen en la tabla \`categories\` (se importaron
-- desde WooCommerce con su \`woo_id\`). Este script solo agrega la columna
-- \`parent_id\` y reconstruye los vínculos padre/hijo.

-- 1) Columna de jerarquía + índice.
alter table categories
  add column if not exists parent_id uuid references categories(id) on delete set null;
create index if not exists categories_parent_id_idx on categories(parent_id);

-- 2) Vincular cada subcategoría con su padre (mapa woo_id hijo → woo_id padre).
update categories c
set parent_id = p.id
from (values
${valuesSql}
  ) as m(child_woo, parent_woo)
  join categories p on p.woo_id = m.parent_woo
where c.woo_id = m.child_woo
  and c.parent_id is distinct from p.id;

-- 3) (Opcional pero recomendado) Backfill: para los productos que ya existen y
--    están ligados solo a una subcategoría, ligarlos también a su categoría padre
--    para que el filtro por categoría general los muestre. Hacia adelante el
--    formulario de producto ya guarda ambos (padre + subcategoría).
insert into product_categories (product_id, category_id)
select distinct pc.product_id, c.parent_id
from product_categories pc
join categories c on c.id = pc.category_id
where c.parent_id is not null
on conflict (product_id, category_id) do nothing;
`;

writeFileSync("./supabase/categories_hierarchy.sql", sql);
console.log(
  `OK → supabase/categories_hierarchy.sql (${pairs.length} vínculos padre/hijo)`
);
