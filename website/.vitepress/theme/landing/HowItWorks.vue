<script setup lang="ts">
import snippets from "virtual:gtkx-snippets";
import CodeBlock from "../components/CodeBlock.vue";
</script>

<template>
  <section id="how" class="how">
    <div class="how__head section-head">
      <h2 class="section-title">Written in JSX, rendered as GObjects</h2>
    </div>

    <div class="how__step">
      <div class="how__text">
        <h3 class="how__name">Declare your libraries</h3>
        <p class="how__body">
          Name the GIRs you want and codegen reads them off your
          system, emitting typed bindings for exactly those namespaces.
        </p>
      </div>
      <CodeBlock title="gtkx.config.ts" :snippet="snippets.config" />
    </div>

    <div class="how__step  how__step--rev">
      <div class="how__text">
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
        <h3 class="how__name">Vanilla Node, real npm</h3>
        <p class="how__body">
          Your app is a plain Node program, so every npm package and Node API is available to it.
        </p>
      </div>
      <CodeBlock title="package.json" :snippet="snippets.ecosystem" />
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
