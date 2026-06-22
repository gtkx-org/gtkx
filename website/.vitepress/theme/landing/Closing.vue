<script setup lang="ts">
import Button from "../components/Button.vue";
import CodeBlock from "../components/CodeBlock.vue";
import Icon from "../components/Icon.vue";
import { LICENSE, REPO_URL } from "./content";
</script>

<template>
  <section id="open-source" class="oss">
    <div class="oss__inner">
      <div class="oss__text">
        <p class="overline">Free and open source</p>
        <h2 class="oss__title">Built in the open, on the GNOME stack</h2>
        <p class="oss__body">
          gtkx is {{ LICENSE }}-licensed and developed in public. Bring your widgets,
          file an issue, ship a PR.
        </p>
      </div>
      <div class="oss__cta">
        <Button variant="secondary" :href="REPO_URL">
          <template #icon-left><Icon name="github" /></template>
          Contribute on GitHub
        </Button>
        <Button variant="ghost" :href="`${REPO_URL}/tree/main/examples`">
          Browse examples
          <template #icon-right><Icon name="external" :size="15" /></template>
        </Button>
      </div>
    </div>
  </section>

  <section class="cta">
    <span class="glow" />
    <div class="cta__inner">
      <h2 class="cta__title">Start building native Linux apps today</h2>
      <p class="cta__sub">
        One command scaffolds everything — typed widgets, HMR, tests, and production bundling.
      </p>
      <div class="cta__actions">
        <Button size="lg" href="#install">
          Get started
          <template #icon-right><Icon name="arrow" :size="17" /></template>
        </Button>
      </div>
      <div class="cta__cmd">
        <CodeBlock variant="terminal" code="npm create gtkx@latest" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.oss {
  max-width: var(--container-lg);
  margin: 0 auto;
  padding: clamp(2.5rem, 5vw, 4rem) clamp(1rem, 4vw, 2.5rem);
}
.oss__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1.6rem;
  padding: clamp(1.8rem, 3vw, 2.6rem);
  background: var(--bg-soft);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
}
.oss__text .overline {
  color: var(--text-brand);
  margin-bottom: 0.6rem;
}
.oss__title {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: clamp(1.5rem, 3vw, 2.1rem);
  letter-spacing: -0.025em;
  margin: 0 0 0.6rem;
  color: var(--text-1);
}
.oss__body {
  font-family: var(--font-body);
  font-size: var(--text-md);
  color: var(--text-2);
  margin: 0;
  max-width: 34rem;
}
.oss__cta {
  display: flex;
  gap: 0.7rem;
  flex-wrap: wrap;
}
.cta {
  position: relative;
  overflow: hidden;
  margin-top: clamp(1rem, 3vw, 2rem);
}
.cta .glow {
  opacity: 1;
}
.cta__inner {
  position: relative;
  z-index: 1;
  max-width: 40rem;
  margin: 0 auto;
  padding: clamp(3rem, 7vw, 6rem) clamp(1rem, 4vw, 2.5rem);
  text-align: center;
}
.cta__title {
  font-family: var(--font-display);
  font-weight: 900;
  font-size: clamp(2rem, 4.5vw, 3.2rem);
  letter-spacing: -0.03em;
  line-height: 1.05;
  margin: 0;
  color: var(--text-1);
}
.cta__sub {
  font-family: var(--font-body);
  font-size: clamp(1rem, 1.5vw, 1.2rem);
  color: var(--text-2);
  margin: 1rem auto 1.8rem;
  max-width: 30rem;
}
.cta__actions {
  display: flex;
  justify-content: center;
  margin-bottom: 1.4rem;
}
.cta__cmd {
  max-width: 22rem;
  margin: 0 auto;
}
@media (max-width: 720px) {
  .oss__inner {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
