<script setup lang="ts">
import { ref } from "vue";

const props = defineProps<{
    items: { value: string; label: string }[];
    variant?: "underline" | "pill";
    controls?: string;
    label?: string;
}>();
const model = defineModel<string>();
const buttons = ref<HTMLButtonElement[]>([]);

const move = (index: number, offset: number): void => {
    const next = (index + offset + props.items.length) % props.items.length;
    model.value = props.items[next].value;
    buttons.value[next]?.focus();
};
</script>

<template>
  <div class="tabs" :class="`tabs--${variant ?? 'underline'}`" role="tablist" :aria-label="label">
    <button
      v-for="(it, i) in items"
      :key="it.value"
      ref="buttons"
      type="button"
      role="tab"
      class="tabs__btn"
      :class="{ 'is-active': model === it.value }"
      :aria-selected="model === it.value"
      :aria-controls="controls"
      :tabindex="model === it.value ? 0 : -1"
      @click="model = it.value"
      @keydown.arrow-left.prevent="move(i, -1)"
      @keydown.arrow-right.prevent="move(i, 1)"
      @keydown.home.prevent="move(i, -i)"
      @keydown.end.prevent="move(i, items.length - 1 - i)"
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
@media (pointer: coarse) {
  .tabs__btn {
    min-height: 44px;
  }
}
</style>
