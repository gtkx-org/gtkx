<script setup lang="ts">
import snippets from "virtual:gtkx-snippets";
import CodeBlock from "../components/CodeBlock.vue";
</script>

<template>
  <section id="how" class="how">
    <div class="how__head section-head">
      <h2 class="section-title">From JSX to a native window</h2>
    </div>

    <div class="how__step">
      <div class="how__text">
        <h3 class="how__name">Choose your native libraries</h3>
        <p class="how__body">
          Adwaita and GTK are included by default. Add libraries such as WebKitGTK to your
          configuration, then generate their bindings from the installed introspection files.
        </p>
      </div>
      <CodeBlock title="gtkx.config.ts" :snippet="snippets.config" />
    </div>

    <div class="how__step  how__step--rev">
      <div class="how__text">
        <h3 class="how__name">Describe the interface</h3>
        <p class="how__body">
          Use JSX for widgets and the objects they depend on. Props configure them,
          and signal handlers connect user input to your application state.
        </p>
      </div>
      <CodeBlock title="src/app.tsx" :snippet="snippets.app" />
    </div>

    <div class="how__step">
      <div class="how__text">
        <h3 class="how__name">Use Node.js and npm</h3>
        <p class="how__body">
          Read files, make network requests, and use libraries such as Zustand and Zod.
          Your app runs on Node.js; packages that require a browser DOM need a native alternative.
        </p>
      </div>
      <CodeBlock title="Terminal" :snippet="snippets.ecosystem" />
    </div>
  </section>
</template>

<style scoped>
.how {
  max-width: var(--container-lg);
  margin: 0 auto;
  padding: clamp(2.5rem, 5vw, 4.5rem) clamp(1rem, 4vw, 2.5rem);
}
.how__head {
  margin-bottom: clamp(2.5rem, 4vw, 3.5rem);
}
.how__step {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: clamp(1.5rem, 4vw, 3.5rem);
  align-items: center;
  margin-bottom: clamp(2rem, 4vw, 3.5rem);
}
.how__step > :deep(*) {
  min-width: 0;
}
.how__step:last-child {
  margin-bottom: 0;
}
.how__step--rev .how__text {
  order: 2;
}
.how__name {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: var(--text-xl);
  letter-spacing: -0.02em;
  margin: 0 0 0.7rem;
  color: var(--text-1);
}
.how__body {
  font-family: var(--font-body);
  font-size: var(--text-md);
  line-height: 1.6;
  color: var(--text-2);
  margin: 0 0 1.1rem;
}
@media (max-width: 860px) {
  .how__step {
    grid-template-columns: 1fr;
  }
  .how__step--rev .how__text {
    order: 0;
  }
}
</style>
