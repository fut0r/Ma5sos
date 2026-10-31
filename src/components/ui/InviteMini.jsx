import { SaduBand } from './Sadu.jsx';
import { IconCap } from './Icons.jsx';
import './InviteMini.css';

const round = (value) => Math.round(value * 10) / 10;

/* Najd: the triangular wall openings and stepped parapets of mud-brick houses. */
function NajdTop() {
  const triangles = [
    [100, 8],
    [92, 22],
    [108, 22],
    [84, 36],
    [100, 36],
    [116, 36],
  ];
  return (
    <svg viewBox="0 0 200 56" aria-hidden="true">
      {triangles.map(([x, y]) => (
        <path key={`${x}-${y}`} className="o-ac" d={`M${x - 7} ${y + 12}h14l-7-12z`} />
      ))}
    </svg>
  );
}

function NajdBottom() {
  const steps = Array.from({ length: 10 }, (_, i) => i * 20);
  return (
    <svg viewBox="0 0 200 20" aria-hidden="true">
      {steps.map((x) => (
        <path key={x} className="o-ac" d={`M${x} 20v-8h4V6h4V0h4v6h4v6h4v8z`} />
      ))}
    </svg>
  );
}

/* Khuzama: three lavender sprigs. */
function KhuzamaBottom() {
  const sprigs = [
    { x: 78, angle: -15, scale: 0.9 },
    { x: 100, angle: 0, scale: 1.1 },
    { x: 122, angle: 15, scale: 0.9 },
  ];
  const buds = [0, 1, 2, 3, 4];
  return (
    <svg viewBox="0 0 200 70" aria-hidden="true">
      {sprigs.map(({ x, angle, scale }) => (
        <g key={x} transform={`translate(${x} 70) rotate(${angle}) scale(${scale})`}>
          <path className="o-ac-stroke" d="M0 0v-50" />
          <ellipse className="o-ac" cx="0" cy="-54" rx="3.2" ry="5" />
          {buds.map((i) => (
            <g key={i}>
              <ellipse className="o-ac" cx="-4.6" cy={-46 + i * 7.5} rx="3.2" ry="4.4" />
              <ellipse className="o-ac" cx="4.6" cy={-46 + i * 7.5} rx="3.2" ry="4.4" />
            </g>
          ))}
        </g>
      ))}
    </svg>
  );
}

/* Nakheel: a palm crown fanning up from the bottom edge. */
function NakheelBottom() {
  const cx = 100;
  const cy = 76;
  const fronds = Array.from({ length: 9 }, (_, i) => {
    const angle = ((-80 + i * 20) * Math.PI) / 180;
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    const tip = [cx + 68 * sin, cy - 68 * cos];
    const mid = [cx + 30 * sin, cy - 30 * cos];
    const off = [6.5 * cos, 6.5 * sin];
    return [
      `M${cx} ${cy}`,
      `L${round(mid[0] - off[0])} ${round(mid[1] - off[1])}`,
      `L${round(tip[0])} ${round(tip[1])}`,
      `L${round(mid[0] + off[0])} ${round(mid[1] + off[1])}Z`,
    ].join('');
  });
  return (
    <svg viewBox="0 0 200 76" aria-hidden="true">
      {fronds.map((d, i) => (
        <path key={d} d={d} className={i % 2 ? 'o-ac' : 'o-alt'} />
      ))}
    </svg>
  );
}

/* Rimal: two dunes under a low sun. */
function RimalBottom() {
  return (
    <svg viewBox="0 0 200 68" aria-hidden="true">
      <circle className="o-ac" cx="150" cy="18" r="11" />
      <path className="o-alt" d="M0 68V42c28-14 56-14 86-2s74 14 114-8v36z" />
      <path className="o-ac" d="M0 68V56c36-12 70-10 104 0s64 8 96-4v16z" />
    </svg>
  );
}

function Star({ x, y, r, className = 'o-ac' }) {
  return (
    <g className={className}>
      <rect x={x - r} y={y - r} width={r * 2} height={r * 2} />
      <rect x={x - r} y={y - r} width={r * 2} height={r * 2} transform={`rotate(45 ${x} ${y})`} />
    </g>
  );
}

/* Thuraya: eight-point stars, the Pleiades over a night sky. */
function ThurayaTop() {
  return (
    <svg viewBox="0 0 200 64" aria-hidden="true">
      <Star x={100} y={32} r={10} />
      <Star x={60} y={22} r={5.5} />
      <Star x={140} y={22} r={5.5} />
      <Star x={30} y={42} r={3.2} />
      <Star x={170} y={42} r={3.2} />
      <Star x={78} y={52} r={2.2} />
      <Star x={124} y={50} r={2.2} />
    </svg>
  );
}

/* Ward: a Taif rose built from turned squares. */
function WardTop() {
  const layers = [
    { r: 20, angle: 0, className: 'o-ac' },
    { r: 13, angle: 22.5, className: 'o-bg' },
    { r: 7, angle: 0, className: 'o-ac' },
  ];
  return (
    <svg viewBox="0 0 200 70" aria-hidden="true">
      <path className="o-alt" d="M46 38l14-7 14 7-14 7zM126 38l14-7 14 7-14 7z" />
      {layers.map(({ r, angle, className }) => (
        <g key={r} transform={`rotate(${angle} 100 38)`}>
          <Star x={100} y={38} r={r} className={className} />
        </g>
      ))}
    </svg>
  );
}

const ORNAMENTS = {
  sadu: {
    top: <SaduBand tiles={6} a="var(--i-ac)" b="var(--i-fg)" c="var(--i-bg)" />,
    bottom: <SaduBand tiles={6} a="var(--i-ac)" b="var(--i-fg)" c="var(--i-bg)" />,
  },
  najd: { top: <NajdTop />, bottom: <NajdBottom /> },
  khuzama: { bottom: <KhuzamaBottom /> },
  bisht: { top: <IconCap className="invite__cap" /> },
  nakheel: { bottom: <NakheelBottom /> },
  rimal: { bottom: <RimalBottom /> },
  thuraya: { top: <ThurayaTop /> },
  ward: { top: <WardTop /> },
};

export default function InviteMini({ template }) {
  const { id, bg, fg, ac, kicker, pre, title, date } = template;
  const ornament = ORNAMENTS[id] ?? {};

  return (
    <div className={`invite invite--${id}`} style={{ '--i-bg': bg, '--i-fg': fg, '--i-ac': ac }}>
      <div className="invite__sheet">
        <div className="invite__orn">{ornament.top}</div>
        <div className="invite__body">
          <span className="invite__kicker">{kicker}</span>
          <span className="invite__pre">{pre}</span>
          <strong className="invite__title">{title}</strong>
          <span className="invite__date">{date}</span>
        </div>
        <div className="invite__orn">{ornament.bottom}</div>
      </div>
    </div>
  );
}
