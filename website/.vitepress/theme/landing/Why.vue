<script setup lang="ts">
import Icon from "../components/Icon.vue";
import { docsLink } from "./content";

const NODE_SIDE = ["npm", "Vite", "Vitest", "React"];
const GLIB_SIDE = ["GTK 4", "libadwaita", "the libraries you add"];
</script>

<template>
    <section id="why" class="section section--alt">
        <div class="section__inner why">
            <div class="why__text">
                <p class="overline">Why GTKX</p>
                <h2 class="section-title">Node.js owns the process</h2>
                <p class="section-sub">
                    That is why npm packages, Vite, and Vitest work in a GTKX app. GTKX targets one platform, GTK and
                    Adwaita on Linux, and exposes all of it.
                </p>
                <p class="why__gjs">
                    In <a href="https://gjs.guide">GJS</a>, GNOME's JavaScript runtime, it is the reverse: your code
                    runs inside GLib's main loop, without Node.js APIs or Node-native tooling.
                </p>
                <div class="why__links">
                    <a class="more" :href="docsLink('guide/why-gtkx')">Why GTKX <Icon name="arrow" :size="15" /></a>
                    <a class="more" :href="docsLink('guide/comparisons')"
                        >GJS, React Native, gtk4-rs, and Relm4 compared <Icon name="arrow" :size="15"
                    /></a>
                </div>
            </div>
            <figure class="loop">
                <div class="loop__ring loop__ring--node">
                    <p class="loop__name">Node.js event loop <span>your app</span></p>
                    <ul class="loop__chips">
                        <li v-for="chip in NODE_SIDE" :key="chip">{{ chip }}</li>
                    </ul>
                    <div class="loop__ring loop__ring--glib">
                        <p class="loop__name">GLib main loop <span>driven by GTKX</span></p>
                        <ul class="loop__chips">
                            <li v-for="chip in GLIB_SIDE" :key="chip">{{ chip }}</li>
                        </ul>
                    </div>
                </div>
                <figcaption>GLib's main loop runs inside Node's, on the main thread.</figcaption>
            </figure>
        </div>
    </section>
</template>

<style scoped>
.why {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr);
  gap: 2.5rem clamp(2rem, 5vw, 4rem);
  align-items: center;
}
.why__text {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  min-width: 0;
}
.why__gjs {
  max-width: 34rem;
  margin: 0;
  color: var(--text-2);
}
.why__links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1.5rem;
  margin-top: 0.4rem;
}
.loop {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  min-width: 0;
  margin: 0;
}
.loop__ring {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}
.loop__ring--node {
  padding: 1.4rem;
  border: 2px solid var(--brand);
  border-radius: 22px;
  background: var(--bg);
}
.loop__ring--glib {
  padding: 1.1rem;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-lg);
  background: var(--bg-alt);
}
.loop__name {
  margin: 0;
  font-family: var(--font-display);
  font-weight: var(--fw-bold);
  font-size: 1.05rem;
  letter-spacing: -0.01em;
  color: var(--text-1);
}
.loop__name span {
  margin-left: 0.4rem;
  font-family: var(--font-body);
  font-weight: var(--fw-regular);
  font-size: 0.9rem;
  letter-spacing: 0;
  color: var(--text-2);
}
.loop__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.loop__chips li {
  padding: 0.15rem 0.7rem;
  border-radius: var(--radius-pill);
  background: var(--brand-soft);
  font-family: var(--font-mono);
  font-size: 0.74rem;
  color: var(--text-brand);
}
.loop__ring--glib .loop__chips li {
  background: var(--bg-soft);
  color: var(--text-2);
}
.loop figcaption {
  font-size: 0.88rem;
  color: var(--text-3);
}
@media (max-width: 1080px) {
  .why {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
