import { useEffect, useRef, useState } from 'react';
import PhotoInvite from './ui/PhotoInvite.jsx';
import { IconClose } from './ui/Icons.jsx';
import { TEMPLATES_COPY } from '../data/content.js';
import { rememberTemplate, selectTemplateHref } from './Templates.jsx';
import './TemplatePreview.css';

/**
 * The full-size preview of a photographed template, in a modal dialog. It
 * opens with the reveal (doors, then text, then buttons); "watch again" plays
 * it once more. Escape, the close button and a click outside all close it.
 */
export default function TemplatePreview({ template, date, isSignedIn = false, onClose }) {
  const dialogRef = useRef(null);
  const [run, setRun] = useState(0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && template && !dialog.open) dialog.showModal();
    if (dialog && !template && dialog.open) dialog.close();
  }, [template]);

  const close = () => {
    dialogRef.current?.close();
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className="tpreview"
      aria-labelledby="tpreview-title"
      onClose={onClose}
      onClick={(event) => event.target === dialogRef.current && close()}
    >
      {template && (
        <div className="tpreview__inner">
          <button type="button" className="icon-btn tpreview__close" onClick={close} aria-label={TEMPLATES_COPY.close}>
            <IconClose />
          </button>

          <div className="tpreview__stage">
            <PhotoInvite key={`${template.id}-${run}`} template={template} date={date} large opening />
          </div>

          <div className="tpreview__info">
            <span className="pill">{template.occasion}</span>
            <h3 className="tpreview__name" id="tpreview-title">
              {template.name}
            </h3>
            <p className="tpreview__text">{template.description}</p>
            <div className="tpreview__actions">
              <a
                className="btn btn--primary"
                href={selectTemplateHref(template.id, isSignedIn)}
                onClick={() => {
                  rememberTemplate(template.id);
                  close();
                }}
              >
                {TEMPLATES_COPY.use}
              </a>
              <button type="button" className="btn btn--ghost" onClick={() => setRun((count) => count + 1)}>
                {TEMPLATES_COPY.replay}
              </button>
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}
