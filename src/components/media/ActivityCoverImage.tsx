"use client";

import { useEffect, useState } from "react";

type ActivityCoverImageProps = {
  src: string;
  fallbackSrc: string;
  alt: string;
  className?: string;
};

export default function ActivityCoverImage({
  src,
  fallbackSrc,
  alt,
  className = "h-full w-full object-cover",
}: ActivityCoverImageProps) {
  const [activeSrc, setActiveSrc] = useState(src);
  const [isUnavailable, setIsUnavailable] = useState(false);

  useEffect(() => {
    setActiveSrc(src);
    setIsUnavailable(false);
  }, [src]);

  if (isUnavailable) {
    return null;
  }

  return (
    <img
      src={activeSrc}
      alt={alt}
      className={className}
      onError={() => {
        if (activeSrc !== fallbackSrc) {
          setActiveSrc(fallbackSrc);
          return;
        }

        setIsUnavailable(true);
      }}
    />
  );
}
