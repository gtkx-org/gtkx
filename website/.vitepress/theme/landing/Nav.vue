<script setup lang="ts">
import { useAppearance } from "../composables/useAppearance";

const { isDark, toggle } = useAppearance();

const links = [
    { label: "Features", href: "#features" },
    { label: "How it works", href: "#how" },
    { label: "Platform", href: "#platform" },
    { label: "Testing", href: "#testing" },
];
</script>

<template>
  <header class="nav">
    <a class="nav__brand" href="#top" aria-label="gtkx home">
      <img src="/gtkx-mark.svg" width="30" height="30" alt="" />
      <span class="nav__word">gtkx</span>
      <Badge tone="neutral" variant="outline">v1.0</Badge>
    </a>
    <nav class="nav__links">
      <a v-for="l in links" :key="l.href" :href="l.href">{{ l.label }}</a>
    </nav>
    <div class="nav__actions">
      <IconButton label="Toggle theme" @click="toggle">
        <Icon :name="isDark ? 'sun' : 'moon'" />
      </IconButton>
      <IconButton label="gtkx on GitHub" :href="REPO_URL"><Icon name="github" /></IconButton>
    </div>
  </header>
</template>

<style scoped>
.nav {
  position: sticky;
  top: 0;
  z-index: 20;
  height: var(--nav-h);
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 0 clamp(1rem, 4vw, 2.5rem);
  background: color-mix(in srgb, var(--bg) 78%, transparent);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
}
.nav__brand {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex: none;
  text-decoration: none;
}
.nav__word {
  font-family: var(--font-display);
  font-weight: 900;
  font-size: 1.3rem;
  letter-spacing: -0.03em;
  color: var(--text-1);
}
.nav__links {
  display: flex;
  gap: 1.35rem;
  margin-left: 0.5rem;
}
.nav__links a {
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-2);
  text-decoration: none;
  transition: var(--transition-colors);
}
.nav__links a:hover {
  color: var(--text-1);
}
.nav__actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
@media (max-width: 720px) {
  .nav__links {
    display: none;
  }
}
</style>
