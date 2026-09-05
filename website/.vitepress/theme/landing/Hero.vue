<script setup lang="ts">
import snippets from "virtual:gtkx-snippets";
import Button from "../components/Button.vue";
import CodeBlock from "../components/CodeBlock.vue";
import Icon from "../components/Icon.vue";
import { REPO_URL } from "./content";

const cmd = "npm create gtkx";
</script>

<template>
  <section id="top" class="hero">
    <span class="glow" />
    <div class="hero__grid stack-md">
      <div class="hero__col">
        <p class="overline hero__eyebrow">// React · Node · TypeScript · libadwaita · GTK4</p>
        <h1 class="hero__title">
          The React framework for <span class="gtkx-gradient-text">Linux</span>
        </h1>
        <p class="hero__lede">
          Build native GNOME applications with React and TypeScript.
          GTKX puts libadwaita first and brings the whole platform to standard web tooling.
        </p>
        <div class="hero__actions">
          <div id="install" class="hero__install">
            <CodeBlock variant="terminal" :frame="false" :code="cmd" />
          </div>
          <div class="hero__cta">
            <Button size="lg" href="/guide/getting-started">
              Get started
              <template #icon-right><Icon name="arrow" :size="17" /></template>
            </Button>
            <Button size="lg" variant="secondary" :href="REPO_URL">
              <template #icon-left><Icon name="github" /></template>
              View on GitHub
            </Button>
          </div>
        </div>
      </div>
      <div class="hero__col hero__visual">
        <CodeBlock title="src/index.tsx" :snippet="snippets.hero" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.hero {
  position: relative;
  overflow: hidden;
  padding: clamp(3rem, 9vw, 7rem) 0 clamp(2rem, 5vw, 4rem);
}
.hero__grid {
  position: relative;
  z-index: 1;
  max-width: var(--container-lg);
  margin: 0 auto;
  padding: 0 clamp(1rem, 4vw, 2.5rem);
  display: grid;
  grid-template-columns: 1.05fr 0.95fr;
  gap: clamp(2rem, 5vw, 4rem);
  align-items: center;
}
.hero__eyebrow {
  margin-bottom: 1.4rem;
  color: var(--text-brand);
}
.hero__title {
  font-family: var(--font-display);
  font-weight: 900;
  font-size: clamp(2.4rem, 5.2vw, 4rem);
  line-height: 1.02;
  letter-spacing: -0.035em;
  margin: 0;
  color: var(--text-1);
}
.hero__lede {
  font-family: var(--font-body);
  font-size: clamp(1.05rem, 1.6vw, 1.28rem);
  line-height: 1.5;
  color: var(--text-2);
  margin: 1.4rem 0 1.8rem;
  max-width: 32rem;
}
.hero__lede strong {
  color: var(--text-1);
  font-weight: 600;
}
.hero__actions {
  width: max-content;
  max-width: 100%;
}
.hero__install {
  margin-bottom: 1.6rem;
}
.hero__cta {
  display: flex;
  gap: 0.8rem;
  flex-wrap: wrap;
}
.hero__col {
  min-width: 0;
}
.hero__visual {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
@media (max-width: 480px) {
  .hero__visual :deep(.shiki) {
    font-size: var(--text-xs);
  }
}
</style>
