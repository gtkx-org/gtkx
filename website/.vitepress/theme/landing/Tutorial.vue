<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { featuredVersion, TUTORIAL_ROOT, versionTutorialItems } from "../../versioning.js";
import Icon from "../components/Icon.vue";
import { docsLink } from "./content";
import WindowShot from "./WindowShot.vue";

type Pick = { path: string; image: string; width: number; height: number; caption: string; alt: string };

const PICKS: Pick[] = [
    {
        path: "tutorial/the-note-editor",
        image: "/figures/tutorial-the-note-editor",
        width: 720,
        height: 480,
        caption: "GtkSourceView highlights headings, emphasis, and links as you type.",
        alt: "The Notes window split in two: the sidebar lists five notes with Website relaunch selected, and the content pane, titled Website relaunch, shows its Markdown with highlighted headings, bold text, a link and a numbered list.",
    },
    {
        path: "tutorial/the-markdown-preview",
        image: "/figures/tutorial-the-markdown-preview",
        width: 720,
        height: 480,
        caption: "The same note as a rendered preview.",
        alt: "The Notes window with Website relaunch shown as a rendered preview: a large title, a paragraph with bold text and a kickoff link, a Milestones heading and a numbered list.",
    },
    {
        path: "tutorial/search-in-a-worker",
        image: "/figures/tutorial-search-in-a-worker",
        width: 720,
        height: 480,
        caption: "Full-text search runs in a worker thread, so it never blocks the window.",
        alt: "The Notes window with kickoff typed in the search entry above the sidebar, which lists only Website relaunch and Meeting notes.",
    },
    {
        path: "tutorial/storybook",
        image: "/figures/tutorial-storybook",
        width: 880,
        height: 540,
        caption: "Stories of the preview component in the native Storybook explorer.",
        alt: "The GTKX Storybook window with the Preview/Markdown stories in the sidebar and Formatting selected: the preview shows bold, italic and inline code, and the Controls panel shows the story's Markdown text.",
    },
    {
        path: "tutorial/internationalization",
        image: "/notes-i18n-fr",
        width: 960,
        height: 640,
        caption: "The interface and the rendered note in French.",
        alt: "Notes translated into French, showing a French note rendered as Markdown.",
    },
    {
        path: "tutorial/packaging",
        image: "/figures/tutorial-packaging",
        width: 720,
        height: 480,
        caption: "The About dialog shows the icon, name, and version the packages carry.",
        alt: "The Notes window with the About dialog open: the yellow Notes icon with a Markdown heading mark, the name Notes, the developer GTKX, the version 1.0.0, and Details and Report an Issue rows.",
    },
];

const NARROW = "(max-width: 1080px)";

const items = versionTutorialItems(featuredVersion);
const total = items.filter((item) => item.path !== TUTORIAL_ROOT).length;
const chapters = PICKS.flatMap((pick) => {
    const number = items.findIndex((item) => item.path === pick.path);
    const item = items[number];

    return item === undefined ? [] : [{ ...pick, number, title: item.text, slug: pick.path.replace(/^.*\//, "") }];
});

const selected = ref(0);
const tabs = ref<HTMLButtonElement[]>([]);
const orientation = ref<"vertical" | "horizontal">("vertical");

const select = (index: number): void => {
    selected.value = (index + chapters.length) % chapters.length;
    tabs.value[selected.value]?.focus();
};

const onKeydown = (event: KeyboardEvent): void => {
    const moves: Record<string, number> = {
        ArrowDown: selected.value + 1,
        ArrowRight: selected.value + 1,
        ArrowUp: selected.value - 1,
        ArrowLeft: selected.value - 1,
        Home: 0,
        End: chapters.length - 1,
    };
    const next = moves[event.key];

    if (next === undefined) {
        return;
    }

    event.preventDefault();
    select(next);
};

let narrow: MediaQueryList | undefined;
const syncOrientation = (): void => {
    orientation.value = narrow?.matches === true ? "horizontal" : "vertical";
};

onMounted(() => {
    narrow = window.matchMedia(NARROW);
    narrow.addEventListener("change", syncOrientation);
    syncOrientation();
});
onBeforeUnmount(() => narrow?.removeEventListener("change", syncOrientation));
</script>

<template>
    <section v-if="chapters.length > 0" id="tutorial" class="section">
        <div class="section__inner">
            <div class="section-head">
                <p class="overline">The tutorial</p>
                <h2 class="section-title">Build a notes app</h2>
                <p class="section-sub">
                    Build Notes one feature at a time: Markdown files, a live preview, search in a worker, and link
                    completion. Then test it, translate it, and create installable packages.
                </p>
            </div>
            <div class="tour">
                <div class="tour__nav">
                    <div
                        class="tour__tabs"
                        role="tablist"
                        aria-label="Tutorial chapters"
                        :aria-orientation="orientation"
                        @keydown="onKeydown"
                    >
                        <button
                            v-for="(chapter, i) in chapters"
                            :id="`tour-tab-${chapter.slug}`"
                            :key="chapter.slug"
                            ref="tabs"
                            type="button"
                            role="tab"
                            class="tour__tab"
                            :aria-selected="i === selected"
                            :aria-controls="`tour-panel-${chapter.slug}`"
                            :tabindex="i === selected ? 0 : -1"
                            @click="selected = i"
                        >
                            <span class="tour__number">{{ String(chapter.number).padStart(2, "0") }}</span>
                            <span class="tour__title">{{ chapter.title }}</span>
                        </button>
                    </div>
                    <a class="more tour__all" :href="docsLink(TUTORIAL_ROOT)"
                        >All {{ total }} chapters <Icon name="arrow" :size="15"
                    /></a>
                </div>
                <figure
                    v-for="(chapter, i) in chapters"
                    v-show="i === selected"
                    :id="`tour-panel-${chapter.slug}`"
                    :key="chapter.slug"
                    class="tour__pane"
                    role="tabpanel"
                    :aria-labelledby="`tour-tab-${chapter.slug}`"
                >
                    <div class="tour__stage wall">
                        <WindowShot
                            class="tour__shot"
                            :image="chapter.image"
                            :width="chapter.width"
                            :height="chapter.height"
                            :alt="chapter.alt"
                        />
                    </div>
                    <figcaption>
                        {{ chapter.caption }}
                        <a class="more" :href="docsLink(chapter.path)"
                            >Read the chapter <Icon name="arrow" :size="14"
                        /></a>
                    </figcaption>
                </figure>
            </div>
        </div>
    </section>
</template>

<style scoped>
.tour {
  display: grid;
  grid-template-columns: minmax(0, 300px) minmax(0, 1fr);
  gap: 2rem;
  align-items: start;
}
.tour__nav {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  min-width: 0;
}
.tour__tabs {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.tour__tab {
  display: grid;
  grid-template-columns: 2.2em minmax(0, 1fr);
  gap: 0.25rem;
  align-items: baseline;
  padding: 0.7rem 0.9rem;
  border: 0;
  border-left: 2px solid var(--border);
  background: transparent;
  color: var(--text-2);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: var(--transition-colors);
}
.tour__tab:hover {
  color: var(--text-1);
}
.tour__tab:focus-visible {
  outline-offset: -2px;
}
.tour__tab[aria-selected="true"] {
  border-left-color: var(--brand);
  background: var(--brand-soft);
  color: var(--text-1);
}
.tour__number {
  font-family: var(--font-mono);
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
  color: var(--text-3);
}
.tour__tab[aria-selected="true"] .tour__number {
  color: var(--text-brand);
}
.tour__title {
  font-weight: var(--fw-semibold);
  font-size: 0.98rem;
}
.tour__all {
  margin-left: 1rem;
  font-size: 0.95rem;
}
.tour__pane {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  min-width: 0;
  margin: 0;
}
.tour__stage {
  display: flex;
  justify-content: center;
  padding: clamp(0.9rem, 3vw, 1.9rem);
  border: 1px solid var(--border);
  border-radius: 18px;
}
.tour__shot {
  display: flex;
  align-items: center;
  width: 100%;
  max-width: 720px;
  aspect-ratio: 3 / 2;
}
.tour__pane figcaption {
  font-size: 0.95rem;
  color: var(--text-2);
}
@media (max-width: 1080px) {
  .tour {
    grid-template-columns: minmax(0, 1fr);
    gap: 1.25rem;
  }
  .tour__tabs {
    flex-direction: row;
    gap: 0;
    overflow-x: auto;
  }
  .tour__tab {
    flex: none;
    border-bottom: 2px solid var(--border);
    border-left: 0;
    white-space: nowrap;
  }
  .tour__tab[aria-selected="true"] {
    border-bottom-color: var(--brand);
  }
  .tour__nav {
    display: contents;
  }
  .tour__all {
    order: 3;
    margin-left: 0;
  }
}
</style>
