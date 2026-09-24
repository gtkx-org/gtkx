<script setup lang="ts">
defineProps<{ label: string; href?: string }>();
</script>

<template>
  <component
    :is="href ? 'a' : 'button'"
    :href="href"
    :type="href ? undefined : 'button'"
    class="icon-btn"
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
  width: 40px;
  height: 40px;
  background: transparent;
  color: var(--text-2);
}
.icon-btn:hover {
  background: var(--bg-soft);
  color: var(--text-1);
}
@media (pointer: coarse) {
  .icon-btn {
    width: 44px;
    height: 44px;
  }
}
</style>
