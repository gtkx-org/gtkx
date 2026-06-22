<script setup lang="ts">
const stack = ["GTK 4", "libadwaita", "GNOME", "React", "TypeScript", "Vite", "Rust"];
</script>

<template>
  <section class="eco">
    <p class="eco__label">Built on the platform you already trust</p>
    <ul class="eco__row">
      <li v-for="s in stack" :key="s">{{ s }}</li>
    </ul>
  </section>
</template>

<style scoped>
.eco {
  max-width: var(--container-lg);
  margin: 0 auto;
  padding: clamp(1.5rem, 3vw, 2.5rem) clamp(1rem, 4vw, 2.5rem);
  text-align: center;
}
.eco__label {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: var(--tracking-caps);
  text-transform: uppercase;
  color: var(--text-3);
  margin: 0 0 1.3rem;
}
.eco__row {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: clamp(1.2rem, 4vw, 2.8rem);
}
.eco__row li {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: clamp(1.05rem, 1.6vw, 1.35rem);
  letter-spacing: -0.01em;
  color: var(--text-3);
  transition: var(--transition-colors);
}
.eco__row li:hover {
  color: var(--text-2);
}
</style>
