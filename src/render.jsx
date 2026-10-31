import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@fontsource-variable/cairo';
import '@fontsource/tajawal/400.css';
import '@fontsource/tajawal/500.css';
import '@fontsource/tajawal/700.css';
import '@fontsource/tajawal/800.css';
import './styles/base.css';

// Every page starts here: fonts and base styles first, then its own content.
export function render(page) {
  createRoot(document.getElementById('root')).render(<StrictMode>{page}</StrictMode>);
}
