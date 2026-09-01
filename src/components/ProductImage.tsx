"use client";

import Image from "next/image";
import { ImageOff } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { rewriteMediaUrl } from "@/lib/image-url";

type ProductImageMode = "optimized" | "next-direct" | "native";

const LEGACY_DIRECT_HOSTS = new Set(
  (process.env.NEXT_PUBLIC_TUSTORE_LEGACY_MEDIA_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean)
);
const NEXT_OPTIMIZED_HOSTS = new Set([
  "logo.clearbit.com",
  "cdn.simpleicons.org",
]);

export function normalizeProductImageSrc(src: string | null | undefined): string {
  return rewriteMediaUrl(src);
}

function imageMode(src: string): ProductImageMode {
  if (src.startsWith("/")) return "optimized";

  try {
    const url = new URL(src);
    const host = url.hostname.toLowerCase();

    if (LEGACY_DIRECT_HOSTS.has(host)) return "next-direct";
    const storageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (storageUrl && url.origin === new URL(storageUrl).origin &&
        url.protocol === "https:" && !url.search &&
        url.pathname.startsWith("/storage/v1/object/public/")) {
      return "optimized";
    }
    if (url.protocol === "https:" && NEXT_OPTIMIZED_HOSTS.has(host)) {
      return "optimized";
    }
  } catch {
    return "native";
  }

  return "native";
}

export function MissingProductImage({
  label = "Imagen no disponible",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink-50 px-3 text-center text-xs font-semibold text-ink-400",
        className
      )}
    >
      <ImageOff className="size-6 text-ink-300" aria-hidden="true" />
      <span className="line-clamp-2">{label}</span>
    </div>
  );
}

export function ProductImage({
  src,
  alt,
  sizes,
  className,
  priority,
  placeholderLabel,
  onUnavailable,
}: {
  src: string | null | undefined;
  alt: string;
  sizes?: string;
  className?: string;
  priority?: boolean;
  placeholderLabel?: string;
  onUnavailable?: (src: string) => void;
}) {
  const normalizedSrc = normalizeProductImageSrc(src);
  const [forceDirect, setForceDirect] = useState(false);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setForceDirect(false);
    setBroken(false);
  }, [normalizedSrc]);

  function markBroken() {
    setBroken(true);
    if (normalizedSrc) onUnavailable?.(normalizedSrc);
  }

  if (!normalizedSrc || broken) {
    return <MissingProductImage label={placeholderLabel} />;
  }

  const mode = imageMode(normalizedSrc);
  const imageClassName = cn("object-contain", className);

  if (mode === "native") {
    return (
      <img
        src={normalizedSrc}
        alt={alt}
        referrerPolicy="no-referrer"
        className={cn("absolute inset-0 h-full w-full", imageClassName)}
        onError={markBroken}
      />
    );
  }

  return (
    <Image
      src={normalizedSrc}
      alt={alt}
      fill
      sizes={sizes}
      className={imageClassName}
      priority={priority}
      unoptimized={forceDirect || mode === "next-direct"}
      onError={() => {
        if (mode === "optimized" && !forceDirect) {
          setForceDirect(true);
          return;
        }
        markBroken();
      }}
    />
  );
}
