<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    tone?: "brand" | "neutral" | "accent" | "success" | "warning" | "danger";
    variant?: "solid" | "soft" | "outline";
  }>(),
  { tone: "brand", variant: "soft" },
);

const TONES = {
  brand: { solidBg: "var(--brand)", solidFg: "var(--brand-contrast)", softBg: "var(--brand-soft)", softFg: "var(--text-brand)", bd: "var(--brand-soft-bd)" },
  neutral: { solidBg: "var(--gray-700)", solidFg: "#fff", softBg: "var(--bg-soft)", softFg: "var(--text-2)", bd: "var(--border)" },
  accent: { solidBg: "var(--accent)", solidFg: "#fff", softBg: "var(--accent-soft)", softFg: "var(--accent)", bd: "var(--accent)" },
  success: { solidBg: "var(--success)", solidFg: "#fff", softBg: "var(--success-soft)", softFg: "var(--success)", bd: "var(--success)" },
  warning: { solidBg: "var(--warning)", solidFg: "#fff", softBg: "var(--warning-soft)", softFg: "var(--warning)", bd: "var(--warning)" },
  danger: { solidBg: "var(--danger)", solidFg: "#fff", softBg: "var(--danger-soft)", softFg: "var(--danger)", bd: "var(--danger)" },
} as const;

const style = computed(() => {
  const t = TONES[props.tone];
  if (props.variant === "solid") return { background: t.solidBg, color: t.solidFg, border: "1px solid transparent" };
  if (props.variant === "outline") return { background: "transparent", color: t.solidBg, border: `1px solid ${t.bd}` };
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
