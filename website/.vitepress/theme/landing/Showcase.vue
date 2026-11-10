<script setup lang="ts">
import { ref } from "vue";
import Icon from "../components/Icon.vue";
import { docsLink } from "./content";

const shots = [
    {
        name: "notes-editor",
        chapter: "tutorial/the-note-editor",
        tab: "Edit a Note",
        caption: "GtkSourceView highlights headings, emphasis, links, and front matter as you type.",
        alt: "Notes editing a Markdown note in GtkSourceView, with highlighted headings, emphasis, links, and front matter.",
    },
    {
        name: "notes-i18n-fr",
        chapter: "tutorial/internationalization",
        tab: "Translate the App",
        caption: "The interface and the rendered note in French.",
        alt: "Notes translated into French, showing a French note rendered as Markdown.",
    },
];

const selected = ref(0);
const tabs = ref<HTMLButtonElement[]>([]);

const select = (index: number): void => {
    selected.value = (index + shots.length) % shots.length;
    tabs.value[selected.value]?.focus();
};

const onKeydown = (event: KeyboardEvent): void => {
    const moves: Record<string, number> = {
        ArrowRight: selected.value + 1,
        ArrowLeft: selected.value - 1,
        Home: 0,
        End: shots.length - 1,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    select(next);
};
</script>

<template>
    <section id="tutorial" class="show">
        <div class="show__head section-head">
            <p class="overline">The tutorial</p>
            <h2 class="section-title">Build a notes app</h2>
            <p class="section-sub">
                Build Notes one feature at a time: Markdown files, a live preview, search in a worker, and link
                completion. Then test it, translate it, and create installable packages.
            </p>
        </div>
        <div class="show__viewer">
            <div class="show__tabs" role="tablist" aria-label="Tutorial chapters" @keydown="onKeydown">
                <button
                    v-for="(s, i) in shots"
                    :id="`show-tab-${s.name}`"
                    :key="s.name"
                    ref="tabs"
                    type="button"
                    role="tab"
                    class="show__tab"
                    :aria-selected="i === selected"
                    :aria-controls="`show-panel-${s.name}`"
                    :tabindex="i === selected ? 0 : -1"
                    @click="selected = i"
                >
                    {{ s.tab }}
                </button>
            </div>
            <figure
                v-for="(s, i) in shots"
                v-show="i === selected"
                :id="`show-panel-${s.name}`"
                :key="s.name"
                class="show__pane"
                role="tabpanel"
                :aria-labelledby="`show-tab-${s.name}`"
            >
                <a class="show__frame" :href="docsLink(s.chapter)">
                    <img
                        class="show__img show__img--light"
                        :src="`/${s.name}-light.png`"
                        width="960"
                        height="640"
                        loading="lazy"
                        :alt="s.alt"
                    />
                    <img
                        class="show__img show__img--dark"
                        :src="`/${s.name}-dark.png`"
                        width="960"
                        height="640"
                        loading="lazy"
                        :alt="s.alt"
                    />
                </a>
                <figcaption>
                    {{ s.caption }}
                    <a :href="docsLink(s.chapter)">Read the chapter <Icon name="arrow" :size="14" /></a>
                </figcaption>
            </figure>
        </div>
        <p class="show__more">
            <a :href="docsLink('tutorial/')">Follow the tutorial <Icon name="arrow" :size="15" /></a>
        </p>
    </section>
</template>

<style scoped>
.show {
  max-width: var(--container-lg);
  margin: 0 auto;
  padding: clamp(2.5rem, 5vw, 4.5rem) clamp(1rem, 4vw, 2.5rem);
}
.show__head {
  margin-bottom: clamp(1.8rem, 4vw, 2.8rem);
}
.show__tabs {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.4rem;
  margin-bottom: 1.2rem;
}
.show__tab {
  padding: 0.45rem 1rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: transparent;
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: var(--fw-semibold);
  color: var(--text-2);
  cursor: pointer;
  transition: var(--transition-colors);
}
.show__tab:hover {
  color: var(--text-1);
  border-color: var(--border-strong);
}
.show__tab[aria-selected="true"] {
  background: var(--brand-soft);
  border-color: var(--brand);
  color: var(--text-brand);
}
.show__tab:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: 2px;
}
.show__pane {
  margin: 0;
}
.show__frame {
  display: block;
  max-width: 962px;
  margin: 0 auto;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  transition: border-color var(--dur-base) var(--ease-standard);
}
.show__frame:hover {
  border-color: var(--brand);
}
.show__frame img {
  display: block;
  width: 100%;
  height: auto;
}
.show__frame .show__img--dark,
html.dark .show__frame .show__img--light {
  display: none;
}
html.dark .show__frame .show__img--dark {
  display: block;
}
.show__pane figcaption {
  margin: 0.9rem 0 0;
  text-align: center;
  font-family: var(--font-body);
  font-size: var(--text-sm);
  color: var(--text-2);
}
.show__pane figcaption a,
.show__more a {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-weight: var(--fw-semibold);
  color: var(--text-brand);
  text-decoration: none;
  transition: var(--transition-colors);
}
.show__pane figcaption a {
  gap: 0.3rem;
}
.show__pane figcaption a:hover,
.show__more a:hover {
  color: var(--brand-hover);
}
.show__more {
  margin: 1.6rem 0 0;
  text-align: center;
  font-family: var(--font-body);
}
@media (max-width: 600px) {
  .show__frame {
    height: 280px;
  }
  .show__frame img {
    width: 960px;
    max-width: none;
    margin-left: -290px;
  }
}
</style>
