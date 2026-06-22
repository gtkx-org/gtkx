<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    code?: string;
    lang?: string;
    title?: string;
    variant?: "code" | "terminal";
    showLineNumbers?: boolean;
  }>(),
  { lang: "bash", variant: "code", showLineNumbers: false },
);

const isTerminal = computed(() => props.variant === "terminal");
const lines = computed(() => (props.code != null ? String(props.code).replace(/\n$/, "").split("\n") : null));
const hasHead = computed(() => isTerminal.value || props.title != null);
</script>

<template>
  <div class="cb" :class="{ 'cb--terminal': isTerminal }">
    <div v-if="hasHead" class="cb__head">
      <span v-if="isTerminal" class="cb__lights">
        <span class="cb__light" style="background: #ff5f57" />
        <span class="cb__light" style="background: #febc2e" />
        <span class="cb__light" style="background: #28c840" />
      </span>
      <span class="cb__title">{{ title || lang }}</span>
    </div>
    <pre class="cb__pre"><code class="cb__code"><template v-if="lines"><div v-for="(ln, i) in lines" :key="i" class="cb__line"><span v-if="showLineNumbers" class="cb__ln">{{ i + 1 }}</span><span v-if="isTerminal" class="cb__prompt">$</span><span class="cb__txt">{{ ln || " " }}</span></div></template><slot v-else /></code></pre>
  </div>
</template>

<style scoped>
.cb {
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  font-family: var(--font-mono);
  box-shadow: var(--shadow-md);
}
.cb--terminal {
  background: var(--gray-950);
  border-color: rgba(255, 255, 255, 0.08);
}
.cb__head {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 0.9rem;
  border-bottom: 1px solid var(--border);
  background: var(--bg-alt);
}
.cb--terminal .cb__head {
  border-bottom-color: rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.02);
}
.cb__lights {
  display: inline-flex;
  gap: 0.4rem;
}
.cb__light {
  width: 11px;
  height: 11px;
  border-radius: 50%;
}
.cb__title {
  font-size: var(--text-xs);
  color: var(--text-3);
  font-weight: var(--fw-medium);
}
.cb--terminal .cb__title {
  color: rgba(235, 235, 245, 0.5);
}
.cb__pre {
  margin: 0;
  padding: 1rem 1.2rem;
  font-size: var(--text-sm);
  line-height: 1.6;
  color: var(--text-1);
  overflow-x: auto;
}
.cb--terminal .cb__pre {
  color: rgba(235, 235, 245, 0.88);
}
.cb__code {
  background: none;
  padding: 0;
  color: inherit;
  font-size: inherit;
}
.cb__line {
  display: flex;
}
.cb__ln {
  width: 2.2em;
  flex: none;
  text-align: right;
  padding-right: 1em;
  color: var(--text-3);
  user-select: none;
}
.cb__prompt {
  color: var(--red-400);
  flex: none;
  padding-right: 0.6em;
  user-select: none;
}
.cb__txt {
  flex: 1;
}
</style>
