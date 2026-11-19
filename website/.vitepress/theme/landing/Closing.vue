<script setup lang="ts">
import Button from "../components/Button.vue";
import CodeBlock from "../components/CodeBlock.vue";
import Icon from "../components/Icon.vue";
import { CREATE_COMMAND, docsLink, REPO_URL } from "./content";

const community = [
    { name: "Contribute", href: "/contributing/", body: "Improve the framework, docs, or examples." },
    { name: "Sponsor", href: "https://opencollective.com/gtkx", body: "Fund GTKX on Open Collective." },
    { name: "Discussions", href: `${REPO_URL}/discussions`, body: "Ask questions and share what you build." },
    { name: "Blog", href: "/blog/", body: "Release notes and announcements." },
];
</script>

<template>
    <section id="start" class="section section--alt closing">
        <div class="section__inner">
            <div class="closing__head">
                <div class="closing__text">
                    <h2 class="section-title">Open your first window</h2>
                    <p class="section-sub">Create a project, run it, and edit it while it stays open.</p>
                </div>
                <div class="closing__side">
                    <CodeBlock variant="terminal" :frame="false" :code="CREATE_COMMAND" />
                    <div class="closing__cta">
                        <Button size="lg" :href="docsLink('guide/getting-started')">
                            Get started
                            <template #icon-right><Icon name="arrow" :size="17" /></template>
                        </Button>
                        <Button size="lg" variant="secondary" :href="docsLink('tutorial/')">Follow the tutorial</Button>
                    </div>
                </div>
            </div>
            <ul class="closing__community">
                <li v-for="c in community" :key="c.name">
                    <a :href="c.href">
                        <b>{{ c.name }}</b>
                        <span>{{ c.body }}</span>
                    </a>
                </li>
            </ul>
        </div>
    </section>
</template>

<style scoped>
.section.closing {
  border-bottom: 0;
}
.closing__head {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
  gap: 1.75rem clamp(2rem, 5vw, 4rem);
  align-items: end;
}
.closing__text,
.closing__side {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  min-width: 0;
}
.closing__cta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}
.closing__cta > .btn {
  flex: 1 1 auto;
}
.closing__community {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0 1.75rem;
  margin: clamp(2.25rem, 5vw, 3.5rem) 0 0;
  padding: 0;
  list-style: none;
}
.closing__community a {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  height: 100%;
  padding: 0.9rem 0 1.1rem;
  border-top: 1px solid var(--border-strong);
}
.closing__community b {
  font-family: var(--font-display);
  font-weight: var(--fw-bold);
  color: var(--text-1);
  transition: var(--transition-colors);
}
.closing__community a:hover b {
  color: var(--text-brand);
}
.closing__community span {
  font-size: 0.9rem;
  color: var(--text-2);
}
@media (max-width: 1080px) {
  .closing__head {
    grid-template-columns: minmax(0, 1fr);
    align-items: start;
  }
  .closing__side {
    max-width: 36rem;
  }
  .closing__community {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 560px) {
  .closing__community {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
