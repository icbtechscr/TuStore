"use client";
import { Warp } from "@paper-design/shaders-react";

type Palette = "brand" | "ocean" | "sunset";

const PALETTES: Record<Palette, string[]> = {
  brand: [
    "hsl(232, 64%, 37%)",
    "hsl(255, 100%, 72%)",
    "hsl(135, 63%, 57%)",
    "hsl(232, 64%, 25%)",
  ],
  ocean: [
    "hsl(203, 100%, 62%)",
    "hsl(232, 64%, 37%)",
    "hsl(158, 99%, 59%)",
    "hsl(264, 70%, 45%)",
  ],
  sunset: [
    "hsl(20, 100%, 60%)",
    "hsl(340, 90%, 55%)",
    "hsl(280, 80%, 55%)",
    "hsl(232, 64%, 37%)",
  ],
};

export function BackgroundShader({
  palette = "brand",
  speed = 0.6,
  className = "",
}: {
  palette?: Palette;
  speed?: number;
  className?: string;
}) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden
    >
      <Warp
        style={{ width: "100%", height: "100%" }}
        proportion={0.45}
        softness={1}
        distortion={0.25}
        swirl={0.8}
        swirlIterations={10}
        shape="checks"
        shapeScale={0.1}
        scale={1}
        rotation={0}
        speed={speed}
        colors={PALETTES[palette]}
      />
      <div className="absolute inset-0 bg-ink-900/55" />
    </div>
  );
}
