<script setup lang="ts">
import { computed, ref } from "vue";
import CodeBlock from "../components/CodeBlock.vue";
import Tabs from "../components/Tabs.vue";
import { CREATE_COMMAND } from "./content";

const tab = ref("create");

const STEPS: Record<string, { label: string; cmd: string; description: string }> = {
    create: {
        label: "create",
        cmd: CREATE_COMMAND,
        description: "Create a project with an application window, TypeScript, and test configuration.",
    },
    dev: {
        label: "dev",
        cmd: "npm run dev",
        description: "Open your app and update it as you edit the source.",
    },
    build: {
        label: "build",
        cmd: "npm run build",
        description: "Bundle your app for production.",
    },
    deploy: {
        label: "deploy",
        cmd: "npm run deploy",
        description: "Build installable packages using your app's deployment configuration.",
    },
    codegen: {
        label: "codegen",
        cmd: "npm run codegen",
        description: "Regenerate bindings and the widget reference for your native libraries.",
    },
};

const items = Object.entries(STEPS).map(([value, s]) => ({ value, label: s.label }));
const active = computed(() => STEPS[tab.value]);
</script>

<template>
  <section id="cli" class="platform">
    <div class="platform__head section-head">
      <h2 class="platform__title section-title">Create, run, and package your app</h2>
    </div>
    <div class="platform__panel">
      <Tabs v-model="tab" variant="pill" :items="items" controls="platform-cmd" label="CLI command" />
      <div id="platform-cmd" role="tabpanel" :aria-label="`gtkx ${tab}`" class="platform__tabpanel">
        <CodeBlock variant="terminal">
          <div class="tcmd"><span class="tprompt" aria-hidden="true">$</span> {{ active.cmd }}</div>
        </CodeBlock>
        <p class="platform__description">{{ active.description }}</p>
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
.platform__tabpanel {
  width: 100%;
}
.platform__description {
  margin-top: 1rem;
  color: var(--text-2);
}
</style>
