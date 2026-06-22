<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: "primary" | "secondary" | "ghost" | "accent";
    size?: "sm" | "md" | "lg";
    href?: string;
    fullWidth?: boolean;
    disabled?: boolean;
  }>(),
  { variant: "primary", size: "md", fullWidth: false, disabled: false },
);
</script>

<template>
  <component
    :is="href ? 'a' : 'button'"
    :href="href"
    :disabled="href ? undefined : disabled"
    class="btn"
    :class="[`btn--${variant}`, `btn--${size}`, { 'btn--full': fullWidth }]"
  >
    <slot name="icon-left" />
    <slot />
    <slot name="icon-right" />
  </component>
</template>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-body);
  font-weight: var(--fw-semibold);
  line-height: 1;
  letter-spacing: 0.01em;
  white-space: nowrap;
  text-decoration: none;
  cursor: pointer;
  border: 1px solid transparent;
  transition: var(--transition-colors), transform var(--dur-fast) var(--ease-standard),
    box-shadow var(--dur-fast) var(--ease-standard);
}
.btn--full {
  display: flex;
  width: 100%;
}
.btn:active {
  transform: translateY(1px);
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn--sm {
  height: 32px;
  padding: 0 0.75rem;
  gap: 0.4rem;
  font-size: var(--text-sm);
  border-radius: var(--radius-sm);
}
.btn--md {
  height: 40px;
  padding: 0 1.1rem;
  gap: 0.5rem;
  font-size: var(--text-sm);
  border-radius: var(--radius-md);
}
.btn--lg {
  height: 52px;
  padding: 0 1.6rem;
  gap: 0.6rem;
  font-size: var(--text-md);
  border-radius: var(--radius-md);
}
.btn--primary {
  background: var(--brand);
  color: var(--brand-contrast);
  box-shadow: var(--shadow-brand);
}
.btn--primary:hover {
  background: var(--brand-hover);
}
.btn--accent {
  background: var(--accent);
  color: #fff;
}
.btn--accent:hover {
  background: var(--accent-hover);
}
.btn--secondary {
  background: transparent;
  color: var(--text-1);
  border-color: var(--border-strong);
}
.btn--secondary:hover {
  border-color: var(--brand);
}
.btn--ghost {
  background: transparent;
  color: var(--text-1);
}
.btn--ghost:hover {
  background: var(--bg-soft);
}
</style>
