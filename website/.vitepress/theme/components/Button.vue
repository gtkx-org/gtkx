<script setup lang="ts">
withDefaults(
    defineProps<{
        variant?: "primary" | "secondary" | "ghost";
        size?: "md" | "lg";
        href: string;
    }>(),
    { variant: "primary", size: "md" },
);
</script>

<template>
  <a
    :href="href"
    class="btn"
    :class="[`btn--${variant}`, `btn--${size}`]"
  >
    <slot name="icon-left" />
    <slot />
    <slot name="icon-right" />
  </a>
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
.btn:active {
  transform: translateY(1px);
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
  background: var(--brand-strong);
  color: var(--brand-contrast);
  box-shadow: var(--shadow-brand);
}
.btn--primary:hover {
  background: var(--brand-strong-hover);
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
