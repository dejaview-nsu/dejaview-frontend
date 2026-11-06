import { Play } from "lucide-react";

export const MovieTrailer = () => (
  <section
    aria-label="Трейлер"
    className="flex aspect-video flex-col items-center justify-center gap-3 bg-poster-placeholder p-4 text-center text-on-dark"
  >
    <Play size={40} aria-hidden="true" />
    <p className="text-sm">Трейлер скоро появится</p>
  </section>
);
