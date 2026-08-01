<script setup lang="ts">
import snippets from "virtual:gtkx-snippets";
import CodeBlock from "../components/CodeBlock.vue";
</script>

<template>
  <section id="how" class="how">
    <div class="how__head section-head">
      <p class="overline">JSX to GObject, typed from your system</p>
      <h2 class="section-title">How GTKX works</h2>
    </div>

    <div class="how__step">
      <div class="how__text">
        <span class="how__num">01</span>
        <h3 class="how__name">Your app config drives the codegen</h3>
        <p class="how__body">
          Name the GObject-Introspection libraries you want and codegen reads them off your
          system, emitting typed bindings for exactly those namespaces.
        </p>
      </div>
      <CodeBlock title="gtkx.config.ts" :snippet="snippets.config" />
    </div>

    <div class="how__step  how__step--rev">
      <div class="how__text">
        <span class="how__num">02</span>
        <h3 class="how__name">If it is a GObject, you can write it in JSX</h3>
        <p class="how__body">
          Element types are GObject type names. Nested GObjects go in props,
          so a header bar or an adjustment is an element too, not an object you build on the side.
        </p>
      </div>
      <CodeBlock title="src/app.tsx" :snippet="snippets.app" />
    </div>

    <div class="how__step">
      <div class="how__text">
        <span class="how__num">03</span>
        <h3 class="how__name">Harness the full power of the Node ecosystem</h3>
        <p class="how__body">
          GTKX runs on vanilla Node. So all npm packages work, and so does React.
          Styling is Emotion.
        </p>
      </div>
      <CodeBlock title="src/app.tsx" :snippet="snippets.ecosystem" />
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
.how__num {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-brand);
  letter-spacing: 0.04em;
}
.how__name {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: var(--text-xl);
  letter-spacing: -0.02em;
  margin: 0.5rem 0 0.7rem;
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
