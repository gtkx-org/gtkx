<script setup lang="ts">
import snippets from "virtual:gtkx-snippets";
import { currentVersion, documentationLink, featuredVersion } from "../../versioning.js";
import Button from "../components/Button.vue";
import CodeBlock from "../components/CodeBlock.vue";
import Icon from "../components/Icon.vue";
import { CREATE_COMMAND, docsLink, REPO_URL } from "./content";
</script>

<template>
    <section id="top" class="hero">
        <span class="glow" />
        <div class="hero__grid stack-md">
            <div class="hero__col">
                <p class="overline hero__eyebrow">// React · Node · TypeScript · libadwaita · GTK4</p>
                <h1 class="hero__title">The React framework for <span class="gtkx-gradient-text">Linux</span></h1>
                <p class="hero__lede">
                    Build native Adwaita and GTK apps with the workflow of modern web development: React components,
                    Fast Refresh, native UI tests, and packaging, on Node.js.
                </p>
                <a class="hero__why" :href="docsLink('guide/why-gtkx')"> Why GTKX <Icon name="arrow" :size="15" /> </a>
                <div class="hero__actions">
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
                            View on GitHub
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
            <figure class="hero__col hero__visual">
                <div class="shot">
                    <div class="shot__frame">
                        <img
                            src="/notes-screenshot.png"
                            width="960"
                            height="640"
                            alt="The Notes app from the GTKX tutorial: an Adwaita window with a list of notes next to a note rendered as Markdown."
                        />
                        <span class="shot__ring" aria-hidden="true"><span class="shot__tag">NoteRow</span></span>
                    </div>
                    <CodeBlock
                        class="shot__code"
                        title="src/components/notes-screen.tsx"
                        :snippet="snippets.noteList"
                    />
                </div>
                <figcaption class="shot__caption">
                    <a :href="docsLink('tutorial/')"
                        >The Notes app you build in the tutorial <Icon name="arrow" :size="15"
                    /></a>
                </figcaption>
            </figure>
        </div>
    </section>
</template>

<style scoped>
.hero {
  position: relative;
  overflow: hidden;
  padding: clamp(3rem, 9vw, 7rem) 0 clamp(2rem, 5vw, 4rem);
}
.hero__grid {
  position: relative;
  z-index: 1;
  max-width: var(--container-lg);
  margin: 0 auto;
  padding: 0 clamp(1rem, 4vw, 2.5rem);
  display: grid;
  grid-template-columns: 1.05fr 0.95fr;
  gap: clamp(2rem, 5vw, 4rem);
  align-items: center;
}
.hero__eyebrow {
  margin-bottom: 1.4rem;
  color: var(--text-brand);
}
.hero__title {
  font-family: var(--font-display);
  font-weight: 900;
  font-size: clamp(2.4rem, 5.2vw, 4rem);
  line-height: 1.02;
  letter-spacing: -0.035em;
  margin: 0;
  color: var(--text-1);
}
.hero__lede {
  font-family: var(--font-body);
  font-size: clamp(1.05rem, 1.6vw, 1.28rem);
  line-height: 1.5;
  color: var(--text-2);
  margin: 1.4rem 0 0.8rem;
  max-width: 32rem;
}
.hero__why {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-bottom: 1.8rem;
  font-family: var(--font-body);
  font-weight: var(--fw-semibold);
  color: var(--text-brand);
  text-decoration: none;
  transition: var(--transition-colors);
}
.hero__why:hover {
  color: var(--brand-hover);
}
.hero__actions {
  width: max-content;
  max-width: 100%;
}
.hero__install {
  margin-bottom: 1.6rem;
}
.hero__cta {
  display: flex;
  gap: 0.8rem;
  flex-wrap: wrap;
}
.hero__version {
  margin: 1rem 0 0;
  color: var(--text-2);
  font-size: var(--text-sm);
}
.hero__version a {
  color: var(--text-brand);
}
.hero__col {
  min-width: 0;
}
.hero__visual {
  margin: 0;
}
.shot {
  position: relative;
  padding-bottom: 8.5rem;
}
.shot__frame {
  position: relative;
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
}
.shot__frame img {
  display: block;
  width: 100%;
  height: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
}
.shot__ring {
  position: absolute;
  left: 0.4%;
  top: 21.3%;
  width: 29.2%;
  height: 8.4%;
  border: 2px solid var(--brand);
  border-radius: var(--radius-pill);
  box-shadow: 0 0 0 4px var(--brand-soft);
}
.shot__tag {
  position: absolute;
  left: 50%;
  top: calc(100% + 8px);
  transform: translateX(-50%);
  white-space: nowrap;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: var(--fw-medium);
  color: var(--brand-contrast);
  background: var(--brand-strong);
  padding: 0.1rem 0.5rem;
  border-radius: var(--radius-sm);
}
.shot__code {
  position: absolute;
  left: -2.5rem;
  bottom: 0;
  width: min(27rem, 100%);
  box-shadow: var(--shadow-lg);
}
.shot__code :deep(.shiki) {
  padding: 0.8rem 0.9rem;
  font-size: var(--text-xs);
}
.shot__code :deep(.mark) {
  background: var(--brand-soft);
  outline: 1.5px solid var(--brand);
  border-radius: var(--radius-sm);
}
.shot__caption {
  margin-top: 1rem;
  text-align: right;
  font-family: var(--font-body);
  font-size: var(--text-sm);
}
.shot__caption a {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-weight: var(--fw-semibold);
  color: var(--text-brand);
  text-decoration: none;
  transition: var(--transition-colors);
}
.shot__caption a:hover {
  color: var(--brand-hover);
}
@media (max-width: 860px) {
  .shot {
    padding-bottom: 0;
  }
  .shot__code {
    position: relative;
    left: auto;
    bottom: auto;
    width: auto;
    margin: -1.5rem 0.75rem 0;
  }
  .shot__caption {
    text-align: left;
  }
}
@media (max-width: 480px) {
  .hero__eyebrow {
    display: none;
  }
  .hero__actions {
    width: auto;
  }
  .hero__cta {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.6rem;
  }
  .hero__cta > .btn {
    gap: 0.4rem;
    padding-inline: 0.5rem;
    font-size: 0.9375rem;
  }
  .hero__cta :deep(svg) {
    flex: none;
  }
  .shot__frame {
    height: 300px;
    overflow: hidden;
    border: 1px solid var(--border);
  }
  .shot__frame img {
    width: 960px;
    max-width: none;
    border: 0;
    border-radius: 0;
  }
  .shot__ring {
    left: 4px;
    top: 136px;
    width: 280px;
    height: 54px;
  }
  .shot__code {
    margin: 0.9rem 0 0;
  }
}
</style>
