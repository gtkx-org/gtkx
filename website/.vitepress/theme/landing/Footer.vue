<script setup lang="ts">
import { LICENSE, REPO_URL } from "./content";

const NPM_URL = "https://www.npmjs.com/package";

type Link = { t: string; href: string };
const cols: { h: string; items: Link[] }[] = [
    {
        h: "Docs",
        items: [
            { t: "Why GTKX", href: "/guide/why-gtkx" },
            { t: "Tutorial", href: "/tutorial/" },
            { t: "Testing", href: "/guide/testing" },
            { t: "Packaging", href: "/tutorial/packaging" },
        ],
    },
    {
        h: "Project",
        items: [
            { t: "GitHub", href: REPO_URL },
            { t: "Examples", href: `${REPO_URL}/tree/main/examples` },
            { t: "Issues", href: `${REPO_URL}/issues` },
            { t: "Releases", href: `${REPO_URL}/releases` },
        ],
    },
    {
        h: "Packages",
        items: [
            { t: "@gtkx/react", href: `${NPM_URL}/@gtkx/react` },
            { t: "@gtkx/runtime", href: `${NPM_URL}/@gtkx/runtime` },
            { t: "@gtkx/cli", href: `${NPM_URL}/@gtkx/cli` },
            { t: "@gtkx/testing", href: `${NPM_URL}/@gtkx/testing` },
            { t: "@gtkx/mcp", href: `${NPM_URL}/@gtkx/mcp` },
        ],
    },
    {
        h: "Platform",
        items: [
            { t: "GTK4", href: "https://www.gtk.org" },
            { t: "Adwaita", href: "https://gnome.pages.gitlab.gnome.org/libadwaita/" },
            { t: "GObject", href: "https://docs.gtk.org/gobject/" },
            { t: "GNOME", href: "https://www.gnome.org" },
        ],
    },
];
</script>

<template>
  <footer class="footer">
    <span class="glow glow-soft" />
    <div class="footer__inner">
      <div class="footer__grid">
        <div class="footer__brand">
          <div class="footer__lockup">
            <img src="/gtkx-mark.svg" width="32" height="32" alt="" />
            <span class="footer__word">GTKX</span>
          </div>
          <p class="footer__tag">
            The React framework for Linux. Free &amp; open source.
          </p>
        </div>
        <div v-for="c in cols" :key="c.h" class="footer__col">
          <p class="footer__h">{{ c.h }}</p>
          <ul class="footer__list">
            <li v-for="i in c.items" :key="i.t">
              <a :href="i.href">{{ i.t }}</a>
            </li>
          </ul>
        </div>
      </div>
      <div class="footer__bar">
        <span>© 2026 GTKX contributors · {{ LICENSE }} licensed</span>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.footer {
  position: relative;
  overflow: hidden;
  margin-top: clamp(2rem, 5vw, 4rem);
  border-top: 1px solid var(--border);
  background: var(--bg-alt);
}
.footer__inner {
  position: relative;
  z-index: 1;
  max-width: var(--container-lg);
  margin: 0 auto;
  padding: clamp(2.5rem, 5vw, 4rem) clamp(1rem, 4vw, 2.5rem);
}
.footer__grid {
  display: grid;
  grid-template-columns: 1.6fr repeat(4, 1fr);
  gap: 2rem;
}
.footer__lockup {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 1rem;
}
.footer__word {
  font-family: var(--font-display);
  font-weight: 900;
  font-size: 1.3rem;
  letter-spacing: -0.03em;
  color: var(--text-1);
}
.footer__tag {
  font-family: var(--font-body);
  font-size: var(--text-sm);
  color: var(--text-2);
  line-height: 1.55;
  margin: 0;
  max-width: 20rem;
}
.footer__h {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: var(--text-sm);
  color: var(--text-1);
  margin: 0 0 0.85rem;
}
.footer__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}
.footer__list a {
  font-family: var(--font-body);
  font-size: var(--text-sm);
  color: var(--text-2);
  text-decoration: none;
  transition: var(--transition-colors);
}
.footer__list a:hover {
  color: var(--text-brand);
}
@media (pointer: coarse) {
  .footer__list a {
    display: inline-block;
    padding-block: 0.75rem;
  }
  .footer__list {
    gap: 0;
  }
}
.footer__bar {
  margin-top: 2.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.footer__bar span {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-3);
}
@media (max-width: 760px) {
  .footer__grid {
    grid-template-columns: 1fr 1fr;
  }
}
@media (max-width: 460px) {
  .footer__grid {
    grid-template-columns: 1fr;
  }
}
</style>
