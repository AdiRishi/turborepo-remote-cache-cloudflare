import { defineComponents } from 'blume';

import HomeHero from './components/HomeHero.astro';
import HomeSection from './components/HomeSection.astro';

export default defineComponents({
  mdx: {
    HomeHero,
    HomeSection,
  },
});
