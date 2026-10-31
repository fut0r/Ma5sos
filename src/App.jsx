import Layout from './components/Layout.jsx';
import Hero from './components/Hero.jsx';
import Marquee from './components/Marquee.jsx';
import Features from './components/Features.jsx';
import Steps from './components/Steps.jsx';
import Occasions from './components/Occasions.jsx';
import Templates from './components/Templates.jsx';
import Pricing from './components/Pricing.jsx';
import Faq from './components/Faq.jsx';
import Closing from './components/Closing.jsx';

// The home page.
export default function App() {
  return (
    <Layout>
      <Hero />
      <Marquee />
      <Features />
      <Steps />
      <Occasions />
      <Templates />
      <Pricing />
      <Faq />
      <Closing />
    </Layout>
  );
}
