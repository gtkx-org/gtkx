<script setup lang="ts">
import Closing from "./Closing.vue";
import Footer from "./Footer.vue";
import Hero from "./Hero.vue";
import Showcase from "./Showcase.vue";
import Why from "./Why.vue";
import Workflow from "./Workflow.vue";
</script>

<template>
    <div class="landing">
        <a class="ann" href="/blog/gtkx-2-0-beta-1">
            <span class="ann__tag">NEW</span>
            <span class="ann__txt">GTKX 2.0 beta is available</span>
            <span class="ann__arrow" aria-hidden="true">→</span>
        </a>
        <main>
            <Hero />
            <Workflow />
            <Why />
            <Showcase />
            <Closing />
        </main>
        <Footer />
    </div>
</template>

<style scoped>
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
