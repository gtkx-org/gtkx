<script setup lang="ts">
defineProps<{
    items: { value: string; label: string }[];
    variant?: "underline" | "pill";
}>();
const model = defineModel<string>();
</script>

<template>
  <div class="tabs" :class="`tabs--${variant ?? 'underline'}`">
    <button
      v-for="it in items"
      :key="it.value"
      type="button"
      class="tabs__btn"
      :class="{ 'is-active': model === it.value }"
      @click="model = it.value"
    >
      {{ it.label }}
    </button>
  </div>
</template>

<style scoped>
.tabs--pill {
  display: inline-flex;
  gap: 0.25rem;
  padding: 0.25rem;
  background: var(--bg-soft);
  border-radius: var(--radius-md);
}
.tabs--pill .tabs__btn {
  padding: 0.4rem 0.85rem;
  border: none;
  cursor: pointer;
  border-radius: var(--radius-sm);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: var(--fw-medium);
  background: transparent;
  color: var(--text-2);
  transition: var(--transition-colors);
}
.tabs--pill .tabs__btn.is-active {
  background: var(--bg);
  color: var(--text-1);
  box-shadow: var(--shadow-sm);
}
.tabs--underline {
  display: flex;
  gap: 1.4rem;
  border-bottom: 1px solid var(--border);
}
.tabs--underline .tabs__btn {
  padding: 0.7rem 0.1rem;
  border: none;
  background: none;
  cursor: pointer;
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: var(--fw-semibold);
  color: var(--text-2);
  box-shadow: inset 0 -2px 0 transparent;
  margin-bottom: -1px;
  transition: var(--transition-colors);
}
.tabs--underline .tabs__btn:hover {
  color: var(--text-1);
}
.tabs--underline .tabs__btn.is-active {
  color: var(--text-1);
  box-shadow: inset 0 -2px 0 var(--brand);
}
</style>
