<template>
  <div class="card">
    <span class="card__glow" />
    <div class="card__body"><slot /></div>
  </div>
</template>

<style scoped>
.card {
  position: relative;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  padding: 1.6rem;
  transition: var(--transition-colors), transform var(--dur-base) var(--ease-out),
    box-shadow var(--dur-base) var(--ease-out);
}
.card:hover {
  border-color: var(--brand);
  box-shadow: var(--shadow-lg);
  transform: translateY(-3px);
}
.card__glow {
  position: absolute;
  inset: 0;
  background: var(--gradient-glow);
  opacity: 0.6;
  pointer-events: none;
  transition: opacity var(--dur-base) var(--ease-standard);
}
.card:hover .card__glow {
  opacity: 1;
}
.card__body {
  position: relative;
}
</style>
