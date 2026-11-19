<script setup lang="ts">
import { currentVersion, documentationLink, featuredVersion } from "../../versioning.js";
import Button from "../components/Button.vue";
import CodeBlock from "../components/CodeBlock.vue";
import Icon from "../components/Icon.vue";
import { CREATE_COMMAND, docsLink, REPO_URL } from "./content";
import HeroStage from "./HeroStage.vue";
</script>

<template>
    <section id="top" class="hero">
        <div class="hero__inner">
            <div class="hero__head">
                <div class="hero__main">
                    <a class="hero__news" href="/blog/gtkx-2-0-beta-1">
                        <span class="hero__news-tag">NEW</span>
                        <span class="hero__news-txt">GTKX 2.0 beta is available</span>
                        <span class="hero__news-arrow" aria-hidden="true">→</span>
                    </a>
                    <h1 class="hero__title">The React framework for <span class="gtkx-gradient-text">Linux</span></h1>
                    <p class="hero__lede">
                        Build native Adwaita and GTK apps with the workflow of modern web development: React components,
                        Fast Refresh, native UI tests, and packaging, on Node.js.
                        <a class="hero__why" :href="docsLink('guide/why-gtkx')"
                            >Why GTKX <Icon name="arrow" :size="15"
                        /></a>
                    </p>
                </div>
                <div class="hero__side">
                    <div id="install" class="hero__install">
                        <CodeBlock variant="terminal" :frame="false" :code="CREATE_COMMAND" />
                    </div>
                    <div class="hero__cta">
                        <Button size="lg" :href="docsLink('guide/getting-started')">
                            {{ featuredVersion.status === "prerelease" ? "Try the beta" : "Get started" }}
                            <template #icon-right><Icon name="arrow" :size="17" /></template>
                        </Button>
                        <Button size="lg" variant="secondary" :href="REPO_URL">
                            <template #icon-left><Icon name="github" /></template>
                            GitHub
                        </Button>
                    </div>
                    <p v-if="featuredVersion.status === 'prerelease'" class="hero__version">
                        Prefer the stable release?
                        <a :href="documentationLink(currentVersion, 'guide/getting-started')"
                            >Use GTKX {{ currentVersion.label }}.</a
                        >
                    </p>
                </div>
            </div>
            <HeroStage class="hero__stage" />
            <p class="hero__under">
                <span>Point at a component in the code to find it in the window.</span>
                <a :href="docsLink('tutorial/')"
                    >The Notes app you build in the tutorial <Icon name="arrow" :size="15"
                /></a>
            </p>
        </div>
    </section>
</template>

<style scoped>
.hero {
  padding: clamp(2rem, 5vw, 3.25rem) 0 clamp(2.5rem, 6vw, 4.75rem);
}
.hero__inner {
  max-width: calc(var(--container-xl) + 2 * clamp(1rem, 4vw, 2.5rem));
  margin: 0 auto;
  padding: 0 clamp(1rem, 4vw, 2.5rem);
}
.hero__head {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
  gap: 1.75rem clamp(2rem, 5vw, 4rem);
  align-items: end;
}
.hero__main,
.hero__side {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.hero__main {
  align-items: flex-start;
  gap: 1.4rem;
}
.hero__side {
  gap: 1rem;
}
a.hero__news {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  max-width: 100%;
  padding: 0.25rem 0.75rem 0.25rem 0.3rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--bg-alt);
  color: var(--text-2);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
}
a.hero__news:hover {
  border-color: var(--border-strong);
  color: var(--text-1);
}
.hero__news-tag {
  padding: 0.1rem 0.5rem;
  border-radius: var(--radius-pill);
  background: var(--brand-strong);
  color: var(--brand-contrast);
  font-weight: var(--fw-bold);
  letter-spacing: 0.04em;
}
.hero__news-txt {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hero__news-arrow {
  color: var(--text-brand);
}
.hero .hero__title {
  font-weight: var(--fw-extrabold);
  font-size: clamp(2.5rem, 5vw, 3.7rem);
  line-height: 1.02;
  letter-spacing: -0.035em;
  text-wrap: balance;
}
.hero__lede {
  margin: 0;
  max-width: 36rem;
  font-size: var(--text-md);
  color: var(--text-2);
}
.hero__why {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-weight: var(--fw-semibold);
  white-space: nowrap;
}
.hero__cta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}
.hero__cta > .btn {
  flex: 1 1 auto;
}
.hero__version {
  margin: 0;
  color: var(--text-3);
  font-size: var(--text-sm);
}
.hero__stage {
  margin-top: clamp(1.9rem, 4vw, 2.75rem);
}
.hero__under {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.4rem 1.5rem;
  margin: 1rem 0 0;
  color: var(--text-3);
  font-size: var(--text-sm);
}
.hero__under a {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-weight: var(--fw-semibold);
}
@media (max-width: 1080px) {
  .hero__head {
    grid-template-columns: minmax(0, 1fr);
    align-items: start;
  }
  .hero__side {
    max-width: 36rem;
  }
}
@media (max-width: 480px) {
  .hero__cta > .btn {
    gap: 0.4rem;
    padding-inline: 0.5rem;
    font-size: 0.9375rem;
  }
}
</style>
