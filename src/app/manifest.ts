import type { MetadataRoute } from "next";

// Web App Manifest: permite "instalar" la página como app en el celular.
// start_url = /portal para que el ícono abra directo el portal del colaborador.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Portal TUStore",
    short_name: "Portal TUStore",
    description:
      "Portal del colaborador de TUStore Costa Rica: marcaje, ventas y más.",
    start_url: "/portal",
    scope: "/",
    display: "standalone",
    background_color: "#1b2e54",
    theme_color: "#1b2e54",
    icons: [
      {
        src: "/tustore-favicon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}

