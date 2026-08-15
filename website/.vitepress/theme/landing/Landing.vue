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
</style>
