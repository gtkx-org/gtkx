<script setup lang="ts">
import { computed, ref } from "vue";
import CodeBlock from "../components/CodeBlock.vue";
import Tabs from "../components/Tabs.vue";

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
        out: ["dist/bundle.js: one file", "bundled gtkx.node, gresources, compiled schemas"],
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
    <div class="platform__head section-head">
      <p class="overline">One CLI, the whole lifecycle</p>
      <h2 class="platform__title section-title">Scaffold, develop, ship: <span class="accent">one tool</span></h2>
    </div>
    <div class="platform__panel">
      <Tabs v-model="tab" variant="pill" :items="items" controls="platform-cmd" label="CLI command" />
      <p class="platform__blurb">{{ active.blurb }}</p>
      <div id="platform-cmd" role="tabpanel" :aria-label="`gtkx ${tab}`" class="platform__tabpanel">
        <CodeBlock variant="terminal">
          <div class="tcmd"><span class="tprompt" aria-hidden="true">$</span> {{ active.cmd }}</div>
          <div v-for="(o, i) in active.out" :key="i" class="tout"><span class="tmark" aria-hidden="true">✓</span> {{ o }}</div>
        </CodeBlock>
      </div>
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
  margin-bottom: clamp(1.8rem, 4vw, 2.6rem);
}
.platform__title {
  font-size: clamp(1.7rem, 3.6vw, 2.6rem);
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
.platform__tabpanel {
  width: 100%;
}
</style>
