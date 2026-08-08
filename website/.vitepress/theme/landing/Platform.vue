<script setup lang="ts">
import { computed, ref } from "vue";
import CodeBlock from "../components/CodeBlock.vue";
import Tabs from "../components/Tabs.vue";

const tab = ref("create");

const STEPS: Record<string, { label: string; cmd: string; out: string[] }> = {
    create: {
        label: "create",
        cmd: "npm create gtkx",
        out: ["◇ Project structure created", "◇ Dependencies installed", "◇ Git repository initialized"],
    },
    dev: {
        label: "dev",
        cmd: "gtkx dev",
        out: ["[gtkx] HMR enabled - watching for changes..."],
    },
    build: {
        label: "build",
        cmd: "gtkx build",
        out: ["[gtkx] Building src/index.tsx", "[gtkx] Build complete: dist/bundle.js"],
    },
    codegen: {
        label: "codegen",
        cmd: "gtkx codegen",
        out: ["[gtkx] codegen: regenerated stale bindings"],
    },
};

const items = Object.entries(STEPS).map(([value, s]) => ({ value, label: s.label }));
const active = computed(() => STEPS[tab.value]);
</script>

<template>
  <section id="cli" class="platform">
    <div class="platform__head section-head">
      <h2 class="platform__title section-title">One CLI for the whole lifecycle</h2>
    </div>
    <div class="platform__panel">
      <Tabs v-model="tab" variant="pill" :items="items" controls="platform-cmd" label="CLI command" />
      <div id="platform-cmd" role="tabpanel" :aria-label="`gtkx ${tab}`" class="platform__tabpanel">
        <CodeBlock variant="terminal">
          <div class="tcmd"><span class="tprompt" aria-hidden="true">$</span> {{ active.cmd }}</div>
          <div v-for="(o, i) in active.out" :key="i" class="tdim">{{ o }}</div>
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
