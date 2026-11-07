<script setup lang="ts">
import Icon from "../components/Icon.vue";
import { docsLink } from "./content";
</script>

<template>
    <section id="why" class="why">
        <div class="why__head section-head">
            <p class="overline">Why GTKX</p>
            <h2 class="section-title">Node.js owns the process</h2>
            <p class="section-sub">
                That is why npm packages, Vite, and Vitest work in a GTKX app. GTKX targets one platform, GTK and
                Adwaita on Linux, and exposes all of it.
            </p>
        </div>

        <div class="why__split">
            <figure class="arch">
                <p class="arch__label"><a href="https://gjs.guide">GJS</a></p>
                <div class="arch__outer">
                    <span>GLib main loop</span>
                    <div class="arch__inner"><span>SpiderMonkey: your JavaScript</span></div>
                </div>
                <div class="arch__tags">
                    <i class="arch__tag arch__tag--off">no Node.js APIs</i>
                    <i class="arch__tag arch__tag--off">no Node-native tooling</i>
                </div>
                <figcaption>GNOME's JavaScript runtime. Your code runs inside GLib's main loop.</figcaption>
            </figure>
            <figure class="arch arch--gtkx">
                <p class="arch__label">GTKX</p>
                <div class="arch__outer">
                    <span>Node.js event loop: your app</span>
                    <div class="arch__inner"><span>GLib main loop, driven by GTKX</span></div>
                </div>
                <div class="arch__tags">
                    <i class="arch__tag">npm</i>
                    <i class="arch__tag">Vite</i>
                    <i class="arch__tag">Vitest</i>
                    <i class="arch__tag">React</i>
                </div>
                <figcaption>GLib's main loop runs inside Node's, on the main thread.</figcaption>
            </figure>
        </div>

        <div class="why__others">
            <p>
                <b><a href="https://reactnative.dev">React Native</a></b>
                Abstracts over platforms, mostly mobile, and none of its platforms renders GTK or Adwaita.
            </p>
            <p>
                <b><a href="https://gtk-rs.org/gtk4-rs/">gtk4-rs</a> and <a href="https://relm4.org">Relm4</a></b>
                Rust bindings for GTK, with declarative macros in Relm4. Neither provides hot reloading, a dev server,
                or UI test automation.
            </p>
        </div>

        <div class="why__links">
            <a :href="docsLink('guide/why-gtkx')">Why GTKX <Icon name="arrow" :size="15" /></a>
            <a :href="docsLink('guide/comparisons')">All comparisons <Icon name="arrow" :size="15" /></a>
        </div>
    </section>
</template>

<style scoped>
.why {
  max-width: var(--container-lg);
  margin: 0 auto;
  padding: clamp(2.5rem, 5vw, 4.5rem) clamp(1rem, 4vw, 2.5rem);
}
.why__head {
  margin-bottom: clamp(1.8rem, 4vw, 2.8rem);
}
.why__split,
.why__others {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}
.arch {
  margin: 0;
  padding: 1.3rem;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
}
.arch--gtkx {
  border-color: var(--brand);
  box-shadow: 0 0 0 3px var(--brand-soft);
}
.arch__label {
  font-family: var(--font-display);
  font-weight: var(--fw-extrabold);
  font-size: var(--text-lg);
  margin: 0 0 0.9rem;
  color: var(--text-1);
}
.arch__label a,
.why__others a {
  color: inherit;
  text-decoration: underline;
  text-decoration-color: var(--border-strong);
  text-underline-offset: 3px;
}
.arch__label a:hover,
.why__others a:hover {
  text-decoration-color: var(--brand);
}
.arch__outer {
  padding: 0.7rem;
  border: 1.5px solid var(--border-strong);
  border-radius: var(--radius-lg);
}
.arch--gtkx .arch__outer {
  border-color: var(--brand);
}
.arch__inner {
  padding: 0.6rem;
  background: var(--bg-alt);
  border: 1.5px dashed var(--border-strong);
  border-radius: var(--radius-md);
}
.arch__outer > span,
.arch__inner > span {
  display: block;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-2);
}
.arch__outer > span {
  margin-bottom: 0.55rem;
}
.arch__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.8rem;
}
.arch__tag {
  font-style: normal;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-pill);
  background: var(--brand-soft);
  color: var(--text-brand);
}
.arch__tag--off {
  background: var(--bg-soft);
  color: var(--text-2);
}
.arch figcaption {
  margin-top: 0.9rem;
  font-family: var(--font-body);
  font-size: var(--text-sm);
  line-height: 1.5;
  color: var(--text-2);
}
.why__others {
  margin-top: 1rem;
}
.why__others p {
  margin: 0;
  padding: 1rem 1.2rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  line-height: 1.5;
  color: var(--text-2);
}
.why__others b {
  display: block;
  margin-bottom: 0.2rem;
  font-family: var(--font-display);
  font-size: var(--text-md);
  color: var(--text-1);
}
.why__links {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 1.5rem;
  margin-top: 1.6rem;
}
.why__links a {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-family: var(--font-body);
  font-weight: var(--fw-semibold);
  color: var(--text-brand);
  text-decoration: none;
  transition: var(--transition-colors);
}
.why__links a:hover {
  color: var(--brand-hover);
}
@media (max-width: 860px) {
  .why__split,
  .why__others {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
