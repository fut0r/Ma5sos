export default function SectionHead({ id, eyebrow, title, lead, align = 'center' }) {
  return (
    <header className={`head${align === 'start' ? ' head--start' : ''}`} data-reveal>
      <p className="head__eyebrow">{eyebrow}</p>
      <h2 className="head__title" id={id}>
        {title}
      </h2>
      {lead && <p className="head__lead">{lead}</p>}
    </header>
  );
}
