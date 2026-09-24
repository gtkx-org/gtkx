<template>
  <span class="badge"><slot /></span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-family: var(--font-body);
  font-size: var(--text-xs);
  font-weight: var(--fw-semibold);
  line-height: 1;
  letter-spacing: 0.01em;
  padding: 0.32em 0.6em;
  color: var(--text-2);
  background: transparent;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-pill);
  white-space: nowrap;
}
</style>
