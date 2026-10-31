import { MARQUEE } from '../data/content.js';
import './Marquee.css';

function Group({ hidden }) {
  return (
    <ul className="marquee__group" aria-hidden={hidden || undefined}>
      {MARQUEE.items.map((item) => (
        <li key={item}>
          {item}
          <span className="marquee__sep" />
        </li>
      ))}
    </ul>
  );
}

export default function Marquee() {
  return (
    <div className="marquee" role="region" aria-label={MARQUEE.label}>
      <div className="marquee__track">
        <Group />
        <Group hidden />
      </div>
    </div>
  );
}
