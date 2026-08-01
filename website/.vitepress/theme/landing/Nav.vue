<script setup lang="ts">
import { ref } from "vue";
import Badge from "../components/Badge.vue";
import Icon from "../components/Icon.vue";
import IconButton from "../components/IconButton.vue";
import { useAppearance } from "../composables/use-appearance";
import { REPO_URL } from "./content";

const { isDark, toggle } = useAppearance();
const menuOpen = ref(false);

const links = [
    { label: "Features", href: "#features" },
    { label: "How it works", href: "#how" },
    { label: "Platform", href: "#platform" },
    { label: "Testing", href: "#testing" },
    { label: "Docs", href: "/guide/why-gtkx" },
];
</script>

<template>
  <header class="nav" @keydown.escape="menuOpen = false">
    <a class="nav__brand" href="#top" aria-label="GTKX home">
      <img src="/gtkx-mark.svg" width="30" height="30" alt="" />
      <span class="nav__word">GTKX</span>
      <Badge tone="neutral" variant="outline">1.0 RC</Badge>
    </a>
    <nav class="nav__links" aria-label="Main">
      <a v-for="l in links" :key="l.href" :href="l.href">{{ l.label }}</a>
    </nav>
    <div class="nav__actions">
      <IconButton label="Dark theme" :aria-pressed="isDark" @click="toggle">
        <Icon class="nav__sun" name="sun" />
        <Icon class="nav__moon" name="moon" />
      </IconButton>
      <IconButton label="GTKX on GitHub" :href="REPO_URL"><Icon name="github" /></IconButton>
      <IconButton
        class="nav__burger"
        :label="menuOpen ? 'Close menu' : 'Open menu'"
        :aria-expanded="menuOpen"
        aria-controls="nav-menu"
        @click="menuOpen = !menuOpen"
      >
        <Icon :name="menuOpen ? 'close' : 'menu'" />
      </IconButton>
    </div>
    <nav v-show="menuOpen" id="nav-menu" class="nav__menu" aria-label="Main">
      <a v-for="l in links" :key="l.href" :href="l.href" @click="menuOpen = false">{{ l.label }}</a>
    </nav>
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
.nav__links a,
.nav__menu a {
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-2);
  text-decoration: none;
  transition: var(--transition-colors);
}
.nav__links a:hover,
.nav__menu a:hover {
  color: var(--text-1);
}
.nav__actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.nav__sun,
html.dark .nav__moon {
  display: none;
}
html.dark .nav__sun {
  display: inline;
}
.nav__burger {
  display: none;
}
.nav__menu {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  flex-direction: column;
  padding: 0.4rem clamp(1rem, 4vw, 2.5rem) 0.8rem;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
}
.nav__menu a {
  display: block;
  padding: 0.75rem 0;
}
@media (min-width: 721px) {
  .nav__menu {
    display: none;
  }
}
@media (max-width: 720px) {
  .nav__links {
    display: none;
  }
  .nav__burger {
    display: inline-flex;
  }
  .nav__menu {
    display: flex;
  }
}
</style>
