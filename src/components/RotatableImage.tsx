'use client';

import { useState, useRef, useEffect } from 'react';

interface RotatableImageProps {
  src: string;
  alt: string;
  className?: string;
  /** Show a link to view full size (opens in new tab) */
  linkToFullSize?: boolean;
}

/**
 * Image wrapper with rotate-left / rotate-right controls.
 * Rotation is purely visual (CSS transform) — no server-side changes.
 * The container clips overflow and the image scales down when rotated
 * sideways (90° / 270°) so it never covers surrounding content.
 */
export default function RotatableImage({
  src,
  alt,
  className = '',
  linkToFullSize = false,
}: RotatableImageProps) {
  const [rotation, setRotation] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);
  const [scale, setScale] = useState(1);

  function rotateLeft() {
    setRotation((r) => {
      const next = (r - 90 + 360) % 360;
      return next;
    });
  }

  function rotateRight() {
    setRotation((r) => {
      const next = (r + 90) % 360;
      return next;
    });
  }

  // Compute scale so the rotated image fits within its original bounding box
  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    function recalc() {
      const el = imgRef.current;
      if (!el) return;
      const isSideways = rotation % 180 !== 0;
      if (!isSideways) {
        setScale(1);
        return;
      }
      // When rotated 90/270, width↔height swap. Scale down so the
      // taller dimension (now width) fits in the container's width,
      // and the wider dimension (now height) fits in the container's height.
      const w = el.naturalWidth || el.offsetWidth;
      const h = el.naturalHeight || el.offsetHeight;
      if (w === 0 || h === 0) { setScale(1); return; }
      // The rotated image occupies h×w inside a w×h slot
      const s = Math.min(w / h, h / w);
      setScale(s);
    }

    recalc();
    // Recalculate if the image loads after mount
    const el = imgRef.current;
    el?.addEventListener('load', recalc);
    return () => el?.removeEventListener('load', recalc);
  }, [rotation]);

  const imgEl = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={imgRef}
      src={src}
      alt={alt}
      className={`transition-transform duration-200 ${className}`}
      style={{
        transform: `rotate(${rotation}deg) scale(${scale})`,
        transformOrigin: 'center center',
      }}
    />
  );

  return (
    <div className="relative group overflow-hidden">
      {linkToFullSize ? (
        <a href={src} target="_blank" rel="noopener noreferrer">
          {imgEl}
        </a>
      ) : (
        imgEl
      )}

      {/* Rotate controls — visible on hover */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); rotateLeft(); }}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 text-sm font-bold shadow"
          title="Rotate left"
        >
          ↶
        </button>
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); rotateRight(); }}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 text-sm font-bold shadow"
          title="Rotate right"
        >
          ↷
        </button>
      </div>
    </div>
  );
}
