import { useId } from 'react';

const TILE = 36;

/**
 * Sadu weaving band: a row of interlocking triangles between two stripes.
 * Fixed pixel height by default; pass `tiles` to make it scale with its width.
 */
export function SaduBand({
  a = 'var(--accent)',
  b = 'var(--ink)',
  c = 'var(--paper)',
  height = TILE,
  tiles,
  className,
}) {
  const id = `sadu-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const fluid = Boolean(tiles);
  const scale = fluid ? 1 : height / TILE;

  return (
    <svg
      className={className}
      width="100%"
      height={fluid ? undefined : height}
      viewBox={fluid ? `0 0 ${TILE * tiles} ${TILE}` : undefined}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <pattern
          id={id}
          width={TILE}
          height={TILE}
          patternUnits="userSpaceOnUse"
          patternTransform={`scale(${scale})`}
        >
          <rect width={TILE} height={TILE} style={{ fill: c }} />
          <path d="M0 0h36v3H0zM0 33h36v3H0z" style={{ fill: b }} />
          <path d="M0 29 9 7l9 22zM18 29l9-22 9 22z" style={{ fill: a }} />
          <path d="M9 7h18l-9 22zM-9 7H9L0 29zM27 7h18l-9 22z" style={{ fill: b }} />
          <path
            d="m18 10.5 2.5 3.5-2.5 3.5-2.5-3.5zM0 10.5l2.5 3.5L0 17.5l-2.5-3.5zM36 10.5l2.5 3.5-2.5 3.5-2.5-3.5z"
            style={{ fill: c }}
          />
          <path d="m9 19 2 3-2 3-2-3zM27 19l2 3-2 3-2-3z" style={{ fill: c }} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
