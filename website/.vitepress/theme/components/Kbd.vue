<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{ keys: string }>();
const caps = computed(() => props.keys.split(" "));
</script>

<template>
  <span class="kbd"><kbd v-for="(k, i) in caps" :key="i" class="kbd__cap">{{ k }}</kbd></span>
</template>

<style scoped>
.kbd {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}
.kbd__cap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.55em;
  height: 1.55em;
  padding: 0 0.4em;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: var(--fw-medium);
  color: var(--text-2);
  background: var(--kbd-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  box-shadow: 0 1px 0 var(--border);
}
</style>
