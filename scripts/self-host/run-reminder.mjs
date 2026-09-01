// Se ejecuta DENTRO del contenedor web. No recibe secretos por URL ni argv.
if (!process.env.CRON_SECRET) throw new Error("Falta CRON_SECRET");
const dry = process.argv.includes("--dry-run") || process.env.TUSTORE_EXTERNAL_EFFECTS_ENABLED === "false";
const response = await fetch(`http://127.0.0.1:3000/api/cron/marcaje-reminder${dry ? "?dry_run=1" : ""}`, {
  headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  signal: AbortSignal.timeout(120000),
});
if (!response.ok) throw new Error(`Recordatorio: HTTP ${response.status}`);
const data = await response.json();
if (dry && data.sent !== 0) throw new Error("La prueba no debe enviar notificaciones");
console.log(JSON.stringify(data));
