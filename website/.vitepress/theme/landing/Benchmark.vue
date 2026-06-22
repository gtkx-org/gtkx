<script setup lang="ts">
import Badge from "../components/Badge.vue";

// NOTE: illustrative idle-memory figures. Replace with measured numbers
// (identical hello-world window, same desktop session) before launch.
const rows = [
  { name: "gtkx", val: "38 MB", pct: 18, brand: true },
  { name: "Flutter (Linux)", val: "92 MB", pct: 44 },
  { name: "Tauri (webview)", val: "120 MB", pct: 57 },
  { name: "Electron + React", val: "210 MB", pct: 100 },
];
</script>

<template>
  <section id="benchmark" class="bench">
    <div class="bench__card">
      <div class="bench__top">
        <div>
          <p class="overline">Native means lean</p>
          <h2 class="bench__title">A hello-world window, idle</h2>
        </div>
        <Badge tone="brand" variant="soft">~5.5× smaller footprint</Badge>
      </div>
      <div class="bench__rows">
        <div v-for="r in rows" :key="r.name" class="bench__row">
          <span class="bench__name" :class="{ 'is-brand': r.brand }">{{ r.name }}</span>
          <span class="bench__track">
            <span class="bench__fill" :class="{ 'is-brand': r.brand }" :style="{ width: `${r.pct}%` }" />
          </span>
          <span class="bench__val" :class="{ 'is-brand': r.brand }">{{ r.val }}</span>
        </div>
      </div>
      <p class="bench__cap">Resident memory of an identical hello-world window at idle — GNOME 47 / Wayland.</p>
    </div>
  </section>
</template>

<style scoped>
.bench {
  max-width: var(--container-lg);
  margin: 0 auto;
  padding: clamp(1rem, 3vw, 2rem) clamp(1rem, 4vw, 2.5rem);
}
.bench__card {
  position: relative;
  padding: clamp(1.5rem, 3vw, 2.5rem);
  background: var(--bg-soft);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
}
.bench__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-bottom: 1.6rem;
}
.bench__top .overline {
  color: var(--text-brand);
  margin-bottom: 0.4rem;
}
.bench__title {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: var(--text-xl);
  margin: 0;
  color: var(--text-1);
}
.bench__rows {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}
.bench__row {
  display: grid;
  grid-template-columns: 150px 1fr 64px;
  align-items: center;
  gap: 1rem;
}
.bench__name {
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-2);
}
.bench__name.is-brand {
  font-weight: 700;
  color: var(--text-1);
}
.bench__track {
  height: 12px;
  border-radius: var(--radius-pill);
  background: var(--bg);
  overflow: hidden;
  border: 1px solid var(--border);
}
.bench__fill {
  display: block;
  height: 100%;
  border-radius: var(--radius-pill);
  background: var(--border-strong);
}
.bench__fill.is-brand {
  background: var(--gradient-brand);
}
.bench__val {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  font-weight: 600;
  text-align: right;
  color: var(--text-3);
}
.bench__val.is-brand {
  color: var(--brand);
}
.bench__cap {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-3);
  margin: 1.4rem 0 0;
}
@media (max-width: 560px) {
  .bench__row {
    grid-template-columns: 110px 1fr 56px;
    gap: 0.6rem;
  }
}
</style>
