import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LENTERA — Smart Tactile Learning System",
    short_name: "LENTERA",
    description:
      "Sistem Pembelajaran Rangkaian Listrik Taktil berbasis Computer Vision, Audio Spasial, dan AI Tutor untuk Siswa Tunanetra.",
    start_url: "/",
    display: "standalone",
    background_color: "#F8F6FF",
    theme_color: "#735CDD",
    orientation: "any",
    icons: [
      {
        src: "/logo-lentera.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}

