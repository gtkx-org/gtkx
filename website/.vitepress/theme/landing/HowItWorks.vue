<script setup lang="ts">
const appCode = `function App() {
  return (
    <AdwApplicationWindow title="Recipes">
      <AdwHeaderBar />
      <GtkLabel label="Hello 👋" />
    </AdwApplicationWindow>
  )
}`;

const devOut = `gtkx dev
✓ dev server ready in 412 ms
✓ watching src/ — Fast Refresh on the live window
~ edited App.tsx → window updated, state kept`;
</script>

<template>
  <section id="how" class="how">
    <div class="how__head">
      <p class="overline">From JSX to native, in one render</p>
      <h2 class="how__title">How GTKX works</h2>
    </div>

    <div class="how__step">
      <div class="how__text">
        <span class="how__num">01</span>
        <h3 class="how__name">Write widgets as JSX</h3>
        <p class="how__body">
          Element types are GTK and libadwaita widget names. Props are their real
          properties; <code class="l-code">on*</code> handlers are their signals. If you know React,
          you already know the API.
        </p>
      </div>
      <CodeBlock title="App.tsx" :code="appCode" />
    </div>

    <div class="how__step how__step--rev">
      <div class="how__text">
        <span class="how__num">02</span>
        <h3 class="how__name">The reconciler maps your tree to live GObjects</h3>
        <p class="how__body">
          A custom react-reconciler turns each element into a real GObject instance and
          keeps it in sync — no virtual DOM diffing a browser. Your component tree
          <em>is</em> the widget tree.
        </p>
        <Callout type="tip">
          A Rust napi addon owns the single GLib main-loop thread and performs every
          libffi call into GTK, so all native mutation stays on one thread.
        </Callout>
      </div>
      <CodeBlock variant="terminal">
        <div class="tcmd"><span class="tprompt">$</span> gtkx build</div>
        <div class="tdim">› react-reconciler → GObject instances</div>
        <div class="tdim">› @gtkx/native → libffi → GTK</div>
        <div class="tout"><span class="tmark">✓</span> dist/bundle.js — single file, assets bundled</div>
      </CodeBlock>
    </div>

    <div class="how__step">
      <div class="how__text">
        <span class="how__num">03</span>
        <h3 class="how__name">Run it with hot reload</h3>
        <p class="how__body">
          <code class="l-code">gtkx dev</code> starts a Vite-based supervisor with Fast Refresh. Edit a
          component and the running native window updates instantly — no restart, no
          lost state.
        </p>
      </div>
      <CodeBlock variant="terminal" :code="devOut" />
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
  text-align: center;
  max-width: 42rem;
  margin: 0 auto clamp(2.5rem, 4vw, 3.5rem);
}
.how__head .overline {
  color: var(--text-brand);
  margin-bottom: 0.7rem;
}
.how__title {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: clamp(1.9rem, 4vw, 3rem);
  letter-spacing: -0.025em;
  margin: 0;
  color: var(--text-1);
}
.how__step {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: clamp(1.5rem, 4vw, 3.5rem);
  align-items: center;
  margin-bottom: clamp(2rem, 4vw, 3.5rem);
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
  color: var(--brand);
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
