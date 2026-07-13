<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
    defineProps<{
        tone?: "brand" | "neutral" | "accent";
        variant?: "solid" | "soft" | "outline";
    }>(),
    { tone: "brand", variant: "soft" },
);

const TONES = {
    brand: {
        solidBg: "var(--brand-strong)",
        solidFg: "var(--brand-contrast)",
        softBg: "var(--brand-soft)",
        softFg: "var(--text-brand)",
        outlineFg: "var(--text-brand)",
        bd: "var(--brand-soft-bd)",
    },
    neutral: {
        solidBg: "var(--gray-700)",
        solidFg: "#fff",
        softBg: "var(--bg-soft)",
        softFg: "var(--text-2)",
        outlineFg: "var(--text-2)",
        bd: "var(--border-strong)",
    },
    accent: {
        solidBg: "var(--accent-strong)",
        solidFg: "#fff",
        softBg: "var(--accent-soft)",
        softFg: "var(--accent-text)",
        outlineFg: "var(--accent-text)",
        bd: "var(--accent)",
    },
} as const;

const style = computed(() => {
    const t = TONES[props.tone];
    if (props.variant === "solid") return { background: t.solidBg, color: t.solidFg, border: "1px solid transparent" };
    if (props.variant === "outline")
        return { background: "transparent", color: t.outlineFg, border: `1px solid ${t.bd}` };
    return { background: t.softBg, color: t.softFg, border: "1px solid transparent" };
});
</script>

<template>
  <span class="badge" :style="style"><slot /></span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-family: var(--font-body);
  font-size: var(--text-xs);
  font-weight: var(--fw-semibold);
  line-height: 1;
  letter-spacing: 0.01em;
  padding: 0.32em 0.6em;
  border-radius: var(--radius-pill);
  white-space: nowrap;
}
</style>
