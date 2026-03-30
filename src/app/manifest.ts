import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MIDAS Finance Tracker",
    short_name: "MIDAS",
    description: "Personal finance tracking with the MIDAS app.",
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#09090b",
    icons: [
      {
        src: "/midas%20no%20bg.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/midas%20no%20bg.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}

