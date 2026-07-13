<script setup lang="ts">
withDefaults(
    defineProps<{
        size?: "sm" | "md" | "lg";
        variant?: "ghost" | "outline" | "solid";
        label: string;
        href?: string;
    }>(),
    { size: "md", variant: "ghost" },
);
</script>

<template>
  <component
    :is="href ? 'a' : 'button'"
    :href="href"
    :type="href ? undefined : 'button'"
    class="icon-btn"
    :class="[`icon-btn--${size}`, `icon-btn--${variant}`]"
    :aria-label="label"
    :title="label"
  >
    <slot />
  </component>
</template>

<style scoped>
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  cursor: pointer;
  border: 1px solid transparent;
  transition: var(--transition-colors);
}
.icon-btn--sm {
  width: 32px;
  height: 32px;
}
.icon-btn--md {
  width: 40px;
  height: 40px;
}
.icon-btn--lg {
  width: 48px;
  height: 48px;
}
@media (pointer: coarse) {
  .icon-btn--sm,
  .icon-btn--md {
    width: 44px;
    height: 44px;
  }
}
.icon-btn--ghost {
  background: transparent;
  color: var(--text-2);
}
.icon-btn--ghost:hover {
  background: var(--bg-soft);
  color: var(--text-1);
}
.icon-btn--outline {
  background: transparent;
  color: var(--text-1);
  border-color: var(--border);
}
.icon-btn--outline:hover {
  background: var(--bg-soft);
}
.icon-btn--solid {
  background: var(--brand);
  color: var(--brand-contrast);
}
.icon-btn--solid:hover {
  background: var(--brand-hover);
}
</style>
