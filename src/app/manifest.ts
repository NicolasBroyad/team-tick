import type { MetadataRoute } from "next";

// Permite instalar la web en la pantalla de inicio y que se abra como app
// (pantalla completa, sin la barra del navegador).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TeamTick",
    short_name: "TeamTick",
    description: "Listas de tareas compartidas para proyectos en equipo.",
    lang: "es",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
