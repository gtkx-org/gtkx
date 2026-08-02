<script setup lang="ts">
import Button from "../components/Button.vue";
import Icon from "../components/Icon.vue";
import { LICENSE, REPO_URL } from "./content";
</script>

<template>
  <section id="open-source" class="oss">
    <div class="oss__inner">
      <div class="oss__text">
        <h2 class="oss__title">Built in the open</h2>
        <p class="oss__body">
          GTKX is {{ LICENSE }}-licensed and developed in public. We're open to contributions, and we welcome feedback and questions on GitHub.
        </p>
      </div>
      <div class="oss__cta">
        <Button variant="secondary" :href="REPO_URL">
          <template #icon-left><Icon name="github" /></template>
          Contribute on GitHub
        </Button>
        <Button variant="ghost" :href="`${REPO_URL}/tree/main/examples`">
          Browse examples
          <template #icon-right><Icon name="external" :size="15" /></template>
        </Button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.oss {
  max-width: var(--container-lg);
  margin: 0 auto;
  padding: clamp(2.5rem, 5vw, 4rem) clamp(1rem, 4vw, 2.5rem);
}
.oss__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1.6rem;
  padding: clamp(1.8rem, 3vw, 2.6rem);
  background: var(--bg-soft);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
}
.oss__text .overline {
  color: var(--text-brand);
  margin-bottom: 0.6rem;
}
.oss__title {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: clamp(1.5rem, 3vw, 2.1rem);
  letter-spacing: -0.025em;
  margin: 0 0 0.6rem;
  color: var(--text-1);
}
.oss__body {
  font-family: var(--font-body);
  font-size: var(--text-md);
  color: var(--text-2);
  margin: 0;
  max-width: 34rem;
}
.oss__cta {
  display: flex;
  gap: 0.7rem;
  flex-wrap: wrap;
}
@media (max-width: 720px) {
  .oss__inner {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
