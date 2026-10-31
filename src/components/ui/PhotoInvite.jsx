import '@fontsource/amiri/400.css';
import '@fontsource/amiri/700.css';
import '@fontsource/aref-ruqaa/400.css';
import '@fontsource/aref-ruqaa/700.css';
import '@fontsource/reem-kufi/700.css';
import '@fontsource/el-messiri/400.css';
import '@fontsource/el-messiri/700.css';
import '@fontsource/rakkas/400.css';
import '@fontsource/marhey/500.css';
import '@fontsource/marhey/700.css';
import '@fontsource/lemonada/500.css';
import '@fontsource/lemonada/700.css';
import { IconStar } from './Icons.jsx';
import './PhotoInvite.css';

/*
 * The typefaces of the photographed templates. These are the invitations' own
 * letters; the site around them stays in Cairo and Tajawal. `scale` evens out
 * how large each face looks at the same size (Amiri and Aref Ruqaa run small,
 * Lemonada wide). Each file loads only when a template that uses it is drawn.
 *
 *   amiri     Naskh in the old printed-Quran tradition: the "Uthmani" look
 *   aref      Ruqaa calligraphy
 *   reem      geometric Kufi
 *   messiri   modern, softly calligraphic
 *   rakkas    heavy decorative display
 *   marhey    rounded and playful, for children
 *   lemonada  round and friendly, for newborns
 */
const FONTS = {
  amiri: { family: "'Amiri', serif", scale: 1.12 },
  aref: { family: "'Aref Ruqaa', serif", scale: 1.18 },
  reem: { family: "'Reem Kufi', sans-serif", scale: 1.28 },
  messiri: { family: "'El Messiri', sans-serif", scale: 1.02 },
  rakkas: { family: "'Rakkas', serif", scale: 1 },
  marhey: { family: "'Marhey', sans-serif", scale: 0.96 },
  lemonada: { family: "'Lemonada', sans-serif", scale: 0.86 },
};

/**
 * A photographed template with its sample invitation laid over the picture.
 * Sizes are in cqw, so the same composition reads as a card thumbnail and as
 * the full preview. `opening` plays the reveal: a sealed pair of doors swings
 * open, then the text and the buttons arrive.
 */
export default function PhotoInvite({ template, date, large = false, opening = false }) {
  const { invite, text } = template;
  const display = FONTS[template.fonts?.display] ?? FONTS.messiri;
  const body = FONTS[template.fonts?.text] ?? FONTS.messiri;

  const style = {
    '--ink': template.ink,
    '--accent': template.accent,
    '--on-accent': template.onAccent,
    '--text-top': text.top,
    '--text-x': text.x,
    '--text-width': text.width,
    '--name-size': template.nameSize,
    '--font-display': display.family,
    '--font-text': body.family,
    '--display-scale': display.scale,
    '--text-scale': body.scale,
  };

  return (
    <div
      className={`pinv pinv--${template.tone}${opening ? ' pinv--opening' : ''}`}
      style={style}
    >
      <img
        className="pinv__photo"
        src={large ? template.full : template.thumb}
        alt=""
        width="900"
        height="1600"
        loading={large ? 'eager' : 'lazy'}
        decoding="async"
      />

      <div className={`pinv__text${text.panel ? ' pinv__text--panel' : ''}`}>
        <p className="pinv__kicker">{invite.kicker}</p>
        <p className="pinv__lead">{invite.lead}</p>
        <p className="pinv__line">{invite.text}</p>
        <p className="pinv__name">{invite.name}</p>
        {invite.note && <p className="pinv__note">{invite.note}</p>}
        <p className="pinv__when">
          {date.weekday}، {date.gregorian}
          <br />
          {date.time} · {invite.venue}
        </p>
      </div>

      {opening && (
        <div className="pinv__doors" aria-hidden="true">
          <span className="pinv__door pinv__door--left" />
          <span className="pinv__door pinv__door--right" />
          <span className="pinv__seal">
            <IconStar />
          </span>
        </div>
      )}
    </div>
  );
}
