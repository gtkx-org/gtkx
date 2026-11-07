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
    <section id="start" class="closing">
        <div class="closing__panel">
            <span class="glow glow-soft" />
            <div class="closing__body">
                <h2 class="section-title">Open your first window</h2>
                <p class="section-sub">Create a project, run it, and edit it while it stays open.</p>
                <div class="closing__install">
                    <CodeBlock variant="terminal" :frame="false" :code="CREATE_COMMAND" />
                </div>
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
    </section>
</template>

<style scoped>
.closing {
  max-width: var(--container-lg);
  margin: 0 auto;
  padding: clamp(2.5rem, 5vw, 4rem) clamp(1rem, 4vw, 2.5rem);
}
.closing__panel {
  position: relative;
  overflow: hidden;
  padding: clamp(2.2rem, 5vw, 3.5rem) clamp(1rem, 4vw, 2.5rem);
  text-align: center;
  background: var(--bg-alt);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
}
.closing__body {
  position: relative;
}
.closing__install {
  display: flex;
  justify-content: center;
  margin: 1.6rem auto 1.4rem;
  max-width: 100%;
  text-align: left;
}
.closing__install > * {
  max-width: 100%;
}
.closing__cta {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.8rem;
}
.closing__community {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
  margin: 1.2rem 0 0;
  padding: 0;
  list-style: none;
}
.closing__community a {
  display: block;
  height: 100%;
  padding: 1rem 1.2rem;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  text-decoration: none;
  transition: var(--transition-colors);
}
.closing__community a:hover {
  border-color: var(--brand);
}
.closing__community b {
  display: block;
  margin-bottom: 0.25rem;
  font-family: var(--font-display);
  font-size: var(--text-md);
  color: var(--text-1);
}
.closing__community span {
  font-family: var(--font-body);
  font-size: var(--text-sm);
  line-height: 1.45;
  color: var(--text-2);
}
@media (max-width: 860px) {
  .closing__community {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 480px) {
  .closing__community {
    grid-template-columns: minmax(0, 1fr);
  }
  .closing__cta {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
