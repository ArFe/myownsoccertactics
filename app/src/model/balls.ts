/**
 * Ball looks. Each style is drawn inside a circle (or an oval) of radius 1,
 * so it can be scaled to any size. Parts are SVG paths in those units.
 */

export type BallStyleId = 'soccer' | 'volleyball' | 'basketball' | 'football';
export type SizeId = 's' | 'm' | 'l' | 'xl';

/** `label` is shown on the button; `name` is what screen readers say. */
export const SIZES: { id: SizeId; label: string; name: string; scale: number }[] = [
  { id: 's', label: 'S', name: 'Small', scale: 0.75 },
  { id: 'm', label: 'M', name: 'Medium', scale: 1 },
  { id: 'l', label: 'L', name: 'Large', scale: 1.35 },
  { id: 'xl', label: 'XL', name: 'Extra large', scale: 1.75 },
];
export const SIZE_IDS = SIZES.map((s) => s.id);

export function sizeScale(id: SizeId): number {
  return SIZES.find((s) => s.id === id)?.scale ?? 1;
}

export interface BallColorSlot {
  key: string;
  label: string;
  default: string;
}

export interface BallPart {
  /** SVG path in units of the ball's radius, centred on 0, 0. */
  path: string;
  /** Colour slot key. */
  color: string;
  /** Drawn as a line of this width (in radius units) instead of filled. */
  line?: number;
}

export interface BallStyle {
  id: BallStyleId;
  label: string;
  /** Oval balls are 1 wide and `ovalHeight` tall (radius units). */
  shape: 'round' | 'oval';
  ovalHeight?: number;
  colors: BallColorSlot[];
  /** Slot that fills the ball's body. */
  body: string;
  parts: BallPart[];
}

const f = (n: number): string => (Math.round(n * 1000) / 1000).toString();
const rad = (deg: number): number => (deg * Math.PI) / 180;
const at = (r: number, deg: number): [number, number] => [r * Math.cos(rad(deg)), r * Math.sin(rad(deg))];

function polygon(cx: number, cy: number, r: number, sides: number, startDeg: number): string {
  const pts = Array.from({ length: sides }, (_, i) => {
    const [x, y] = at(r, startDeg + (360 / sides) * i);
    return `${f(cx + x)} ${f(cy + y)}`;
  });
  return `M ${pts.join(' L ')} Z`;
}

/** A classic ball: a centre pentagon, five around the edge, and the seams between. */
function soccerParts(): BallPart[] {
  const r = 0.29;
  const parts: BallPart[] = [{ path: polygon(0, 0, r, 5, -90), color: 'patches' }];
  const seams: string[] = [];
  for (let k = 0; k < 5; k++) {
    const a = -90 + 72 * k;
    const [cx, cy] = at(1, a);
    parts.push({ path: polygon(cx, cy, r, 5, a + 180), color: 'patches' });
    const [x1, y1] = at(r, a);
    const [x2, y2] = at(1 - r, a);
    seams.push(`M ${f(x1)} ${f(y1)} L ${f(x2)} ${f(y2)}`);
    // Seam from this outer patch to the next one round the ball.
    const [px, py] = at(r, a + 108);
    const [nx, ny] = at(1, a + 72);
    const [qx, qy] = at(r, a + 72 - 108);
    seams.push(`M ${f(cx + px)} ${f(cy + py)} L ${f(nx + qx)} ${f(ny + qy)}`);
  }
  parts.push({ path: seams.join(' '), color: 'patches', line: 0.04 });
  return parts;
}

/**
 * Three curved panels that swirl out from the centre, each followed by a
 * thinner panel in the second colour, 120 degrees apart.
 */
function volleyballParts(): BallPart[] {
  // A panel between two curves from the centre to past the edge (the clip
  // cuts it to the ball). Bending the curves backwards makes the swirl.
  const panel = (fromDeg: number, toDeg: number): string => {
    const [ax, ay] = at(1.3, fromDeg);
    const [bx, by] = at(1.3, toDeg);
    const [c1x, c1y] = at(0.8, fromDeg - 45);
    const [c2x, c2y] = at(0.8, toDeg - 45);
    return `M 0 0 Q ${f(c1x)} ${f(c1y)} ${f(ax)} ${f(ay)} L ${f(bx)} ${f(by)} Q ${f(c2x)} ${f(c2y)} 0 0 Z`;
  };
  // Yellow and blue only, like a match ball: three blue swirls on yellow.
  return [-90, 30, 150].map((a) => ({ path: panel(a, a + 60), color: 'panel2' }));
}

function basketballParts(): BallPart[] {
  return [
    {
      path: 'M 0 -1 L 0 1 M -1 0 L 1 0 M -0.62 -0.8 Q -0.12 0 -0.62 0.8 M 0.62 -0.8 Q 0.12 0 0.62 0.8',
      color: 'lines',
      line: 0.07,
    },
  ];
}

function footballParts(): BallPart[] {
  return [
    { path: 'M -0.74 -1 L -0.64 -1 L -0.64 1 L -0.74 1 Z M 0.64 -1 L 0.74 -1 L 0.74 1 L 0.64 1 Z', color: 'stripes' },
    {
      path: 'M -0.3 -0.04 L 0.3 -0.04 M -0.22 -0.14 L -0.22 0.06 M -0.11 -0.14 L -0.11 0.06 M 0 -0.14 L 0 0.06 M 0.11 -0.14 L 0.11 0.06 M 0.22 -0.14 L 0.22 0.06',
      color: 'stripes',
      line: 0.05,
    },
  ];
}

export const BALL_STYLES: Record<BallStyleId, BallStyle> = {
  soccer: {
    id: 'soccer',
    label: 'Soccer',
    shape: 'round',
    colors: [
      { key: 'body', label: 'Ball', default: '#FFFFFF' },
      { key: 'patches', label: 'Patches', default: '#111827' },
    ],
    body: 'body',
    parts: soccerParts(),
  },
  volleyball: {
    id: 'volleyball',
    label: 'Volleyball',
    shape: 'round',
    colors: [
      { key: 'panel1', label: 'Panel 1', default: '#FFD23F' },
      { key: 'panel2', label: 'Panel 2', default: '#1E5AA8' },
    ],
    body: 'panel1',
    parts: volleyballParts(),
  },
  basketball: {
    id: 'basketball',
    label: 'Basketball',
    shape: 'round',
    colors: [
      { key: 'body', label: 'Ball', default: '#E8772E' },
      { key: 'lines', label: 'Lines', default: '#1F1F1F' },
    ],
    body: 'body',
    parts: basketballParts(),
  },
  football: {
    id: 'football',
    label: 'American football',
    shape: 'oval',
    ovalHeight: 0.6,
    colors: [
      { key: 'body', label: 'Ball', default: '#7B3F1D' },
      { key: 'stripes', label: 'Stripes and laces', default: '#FFFFFF' },
    ],
    body: 'body',
    parts: footballParts(),
  },
};

export const BALL_STYLE_IDS = Object.keys(BALL_STYLES) as BallStyleId[];

export function defaultBallColors(style: BallStyleId): Record<string, string> {
  return Object.fromEntries(BALL_STYLES[style].colors.map((c) => [c.key, c.default]));
}
