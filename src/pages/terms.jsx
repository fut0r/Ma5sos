import { render } from '../render.jsx';
import Layout from '../components/Layout.jsx';
import LegalPage from '../components/LegalPage.jsx';
import { TERMS } from '../data/legal.js';

render(
  <Layout>
    <LegalPage doc={TERMS} />
  </Layout>,
);
