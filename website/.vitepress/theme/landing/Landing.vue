<script setup lang="ts">
import Closing from "./Closing.vue";
import Features from "./Features.vue";
import Footer from "./Footer.vue";
import Hero from "./Hero.vue";
import HowItWorks from "./HowItWorks.vue";
import Nav from "./Nav.vue";
import Platform from "./Platform.vue";
import Showcase from "./Showcase.vue";
</script>

<template>
  <div class="landing">
    <a class="skip-link" href="#main">Skip to content</a>
    <a class="ann" href="/guide/upgrading-to-2">
      <span class="ann__tag">NEW</span>
      <span class="ann__txt">GTKX 2.0: Upgrade from 1.x</span>
      <span class="ann__arrow" aria-hidden="true">→</span>
    </a>
    <Nav />
    <main id="main">
      <Hero />
      <Features />
      <HowItWorks />
      <Platform />
      <Showcase />
      <Closing />
    </main>
    <Footer />
  </div>
</template>

<style scoped>
.skip-link {
  position: absolute;
  top: -100px;
  left: 1rem;
  z-index: 100;
  padding: 0.6rem 1rem;
  background: var(--bg-elevated);
  color: var(--text-1);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  font-family: var(--font-body);
  font-weight: var(--fw-semibold);
  font-size: var(--text-sm);
  text-decoration: none;
}
.skip-link:focus-visible {
  top: 1rem;
}
.ann {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  padding: 0.5rem 1rem;
  background: var(--bg-alt);
  border-bottom: 1px solid var(--border);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-2);
  text-decoration: none;
  transition: var(--transition-colors);
}
.ann:hover {
  color: var(--text-1);
}
.ann__tag {
  font-weight: 700;
  color: var(--brand-contrast);
  background: var(--brand-strong);
  border-radius: var(--radius-pill);
  padding: 0.1rem 0.45rem;
  letter-spacing: 0.04em;
}
.ann__arrow {
  color: var(--brand);
}
@media (max-width: 560px) {
  .ann__txt {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 60vw;
  }
}
</style>
