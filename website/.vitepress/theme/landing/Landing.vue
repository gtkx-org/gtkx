<script setup lang="ts">
</script>

<template>
  <div class="landing">
    <a class="ann" :href="`${REPO_URL}/releases`">
      <span class="ann__tag">NEW</span>
      <span class="ann__txt">GTKX v1.0 — native GTK4 desktop apps, written in React</span>
      <span class="ann__arrow">→</span>
    </a>
    <Nav />
    <main>
      <Hero />
      <Ecosystem />
      <Features />
      <HowItWorks />
      <Platform />
      <Benchmark />
      <Differentiators />
      <Closing />
    </main>
    <Footer />
  </div>
</template>

<style scoped>
.ann {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  padding: 0.5rem 1rem;
  background: var(--bg-alt);
  border-bottom: 1px solid var(--border);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-2);
  text-decoration: none;
  transition: var(--transition-colors);
}
.ann:hover {
  color: var(--text-1);
}
.ann__tag {
  font-weight: 700;
  color: var(--brand-contrast);
  background: var(--brand);
  border-radius: var(--radius-pill);
  padding: 0.1rem 0.45rem;
  letter-spacing: 0.04em;
}
.ann__arrow {
  color: var(--brand);
}
@media (max-width: 560px) {
  .ann__txt {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 60vw;
  }
}
</style>
