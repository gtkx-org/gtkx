<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{ type?: "tip" | "info" | "note" | "warning" | "danger"; title?: string }>(),
  { type: "tip" },
);

const MAP = {
  tip: { color: "var(--brand)", soft: "var(--brand-soft)", label: "TIP" },
  info: { color: "var(--accent)", soft: "var(--accent-soft)", label: "INFO" },
  note: { color: "var(--text-2)", soft: "var(--bg-soft)", label: "NOTE" },
  warning: { color: "var(--warning)", soft: "var(--warning-soft)", label: "WARNING" },
  danger: { color: "var(--danger)", soft: "var(--danger-soft)", label: "DANGER" },
} as const;

const c = computed(() => MAP[props.type]);
</script>

<template>
  <div class="callout" :style="{ background: c.soft, borderLeftColor: c.color }">
    <div class="callout__label" :style="{ color: c.color }">{{ title || c.label }}</div>
    <div v-if="$slots.default" class="callout__body"><slot /></div>
  </div>
</template>

<style scoped>
.callout {
  border-radius: var(--radius-md);
  border-left: 3px solid;
  padding: 0.85rem 1.1rem;
  font-family: var(--font-body);
}
.callout__label {
  font-family: var(--font-display);
  font-weight: var(--fw-bold);
  font-size: var(--text-sm);
  letter-spacing: 0.04em;
}
.callout__body {
  font-size: var(--text-sm);
  line-height: var(--leading-normal);
  color: var(--text-2);
  margin-top: 0.35rem;
}
</style>
