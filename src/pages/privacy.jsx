import { render } from '../render.jsx';
import Layout from '../components/Layout.jsx';
import LegalPage from '../components/LegalPage.jsx';
import { PRIVACY } from '../data/legal.js';

render(
  <Layout>
    <LegalPage doc={PRIVACY} />
  </Layout>,
);
