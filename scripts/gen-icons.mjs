import { writeFile } from "node:fs/promises";
import sharp from "sharp";

const logoPath = "public/icb-logo.png";

async function squareLogo(size, { safeArea = 0.9 } = {}) {
  const logoSize = Math.round(size * safeArea);
  const logo = await sharp(logoPath)
    .resize(logoSize, logoSize, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: "#ffffff",
    },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toBuffer();
}

function createIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);

  let offset = 6 + pngs.length * 16;
  const entries = pngs.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size === 256 ? 0 : size, 0);
    entry.writeUInt8(size === 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...pngs.map(({ data }) => data)]);
}

const [favicon32, favicon48, favicon192, favicon256, icon512, maskable512] =
  await Promise.all([
    squareLogo(32, { safeArea: 0.96 }),
    squareLogo(48, { safeArea: 0.94 }),
    squareLogo(192, { safeArea: 0.92 }),
    squareLogo(256, { safeArea: 0.92 }),
    squareLogo(512, { safeArea: 0.9 }),
    squareLogo(512, { safeArea: 0.72 }),
  ]);

const faviconIco = createIco([
  { size: 32, data: favicon32 },
  { size: 48, data: favicon48 },
  { size: 256, data: favicon256 },
]);
const appleTouch = await sharp(favicon256).resize(180, 180).png().toBuffer();

await Promise.all([
  writeFile("public/favicon-32.png", favicon32),
  writeFile("public/favicon-48.png", favicon48),
  writeFile("public/favicon-192.png", favicon192),
  // URLs nuevas y estables para forzar a buscadores a abandonar el favicon
  // anterior que conservan en caché.
  writeFile("public/icb-favicon-32.png", favicon32),
  writeFile("public/icb-favicon-48.png", favicon48),
  writeFile("public/icb-favicon-192.png", favicon192),
  writeFile("public/icb-favicon.ico", faviconIco),
  writeFile("public/icon-192.png", favicon192),
  writeFile("public/icon-512.png", icon512),
  writeFile("public/icon-maskable-512.png", maskable512),
  writeFile("public/apple-touch-icon.png", appleTouch),
  writeFile("public/icb-apple-touch-icon.png", appleTouch),
  writeFile("src/app/favicon.ico", faviconIco),
]);

const ogBackground = Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#0f1840"/>
        <stop offset="1" stop-color="#202f82"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="630" fill="url(#bg)"/>
    <circle cx="1110" cy="80" r="250" fill="#55cd6c" opacity="0.12"/>
    <circle cx="80" cy="610" r="220" fill="#55cd6c" opacity="0.08"/>
    <rect x="240" y="90" width="720" height="360" rx="44" fill="#ffffff"/>
    <text x="600" y="520" fill="#ffffff" text-anchor="middle"
      font-family="Arial, Helvetica, sans-serif" font-size="38" font-weight="700">
      Tecnología · Seguridad · Redes · POS
    </text>
    <text x="600" y="570" fill="#bfc7ec" text-anchor="middle"
      font-family="Arial, Helvetica, sans-serif" font-size="25">
      Costa Rica · icbtechscr.com
    </text>
  </svg>
`);
const ogLogo = await sharp(logoPath)
  .resize(620, 300, {
    fit: "contain",
    background: { r: 255, g: 255, b: 255, alpha: 0 },
  })
  .png()
  .toBuffer();

await sharp(ogBackground)
  .composite([{ input: ogLogo, left: 290, top: 120 }])
  .png()
  .toFile("public/og-icb.png");

console.log("Iconos ICB e imagen social generados ✔");
