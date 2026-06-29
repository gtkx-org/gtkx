<script setup lang="ts">
import { computed, ref } from "vue";

const tab = ref("dev");

const STEPS: Record<string, { label: string; blurb: string; cmd: string; out: string[] }> = {
    create: {
        label: "create",
        blurb: "Scaffold a typed app in seconds.",
        cmd: "npm create gtkx@latest",
        out: ["scaffolded recipes/ — typed widgets, tests, HMR", "installed @gtkx/react, @gtkx/ffi, @gtkx/css"],
    },
    dev: {
        label: "dev",
        blurb: "Hot-reloading dev server with Fast Refresh.",
        cmd: "gtkx dev",
        out: ["dev server ready in 412 ms", "Fast Refresh on the live native window"],
    },
    build: {
        label: "build",
        blurb: "Single-file production bundle, GTK assets and all.",
        cmd: "gtkx build",
        out: ["dist/bundle.js — one file", "bundled gtkx.node, gresources, compiled schemas"],
    },
    codegen: {
        label: "codegen",
        blurb: "Regenerate typed bindings from your GIR libraries.",
        cmd: "gtkx codegen",
        out: ["read GObject-Introspection for Gtk, Adw, Gio…", "@gtkx/gi + @gtkx/jsx stores refreshed"],
    },
};

const items = Object.entries(STEPS).map(([value, s]) => ({ value, label: s.label }));
const active = computed(() => STEPS[tab.value]);
</script>

<template>
  <section id="platform" class="platform">
    <div class="platform__head">
      <p class="overline">One CLI, the whole lifecycle</p>
      <h2 class="platform__title">Scaffold, develop, ship — <span class="accent">one tool</span></h2>
    </div>
    <div class="platform__panel">
      <Tabs v-model="tab" variant="pill" :items="items" />
      <p class="platform__blurb">{{ active.blurb }}</p>
      <CodeBlock variant="terminal">
        <div class="tcmd"><span class="tprompt">$</span> {{ active.cmd }}</div>
        <div v-for="(o, i) in active.out" :key="i" class="tout"><span class="tmark">✓</span> {{ o }}</div>
      </CodeBlock>
    </div>
  </section>
</template>

<style scoped>
.platform {
  max-width: var(--container-md);
  margin: 0 auto;
  padding: clamp(2.5rem, 5vw, 4rem) clamp(1rem, 4vw, 2.5rem);
}
.platform__head {
  text-align: center;
  max-width: 42rem;
  margin: 0 auto clamp(1.8rem, 4vw, 2.6rem);
}
.platform__head .overline {
  color: var(--text-brand);
  margin-bottom: 0.7rem;
}
.platform__title {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: clamp(1.7rem, 3.6vw, 2.6rem);
  letter-spacing: -0.025em;
  margin: 0;
  color: var(--text-1);
}
.platform__panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}
.platform__blurb {
  font-family: var(--font-body);
  font-size: var(--text-md);
  color: var(--text-2);
  margin: 0;
  text-align: center;
}
.platform__panel :deep(.cb) {
  width: 100%;
}
</style>
