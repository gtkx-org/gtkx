<script setup lang="ts">
import snippets, { type HighlightedSnippet } from "virtual:gtkx-snippets";
import { computed, onMounted, ref, watch } from "vue";

type Box = [left: number, top: number, right: number, bottom: number];
type Region = { id: string; label: string; style: Record<string, string> };
type Example = {
    file: string;
    snippet: HighlightedSnippet;
    image: string;
    alt: string;
    initial: string;
    regions: Region[];
};

const percent = (value: number, total: number): string => `${(value / total) * 100}%`;

const regions = (width: number, height: number, boxes: [id: string, label: string, box: Box][]): Region[] =>
    boxes.map(([id, label, [left, top, right, bottom]]) => ({
        id,
        label,
        style: {
            left: percent(left, width),
            top: percent(top, height),
            width: percent(right - left, width),
            height: percent(bottom - top, height),
        },
    }));

const EXAMPLES: [Example, ...Example[]] = [
    {
        file: "notes-screen.tsx",
        snippet: snippets.notesScreen,
        image: "/notes-screenshot",
        alt: "The Notes app from the GTKX tutorial: a sidebar with a search entry, a tag filter and a list of notes, next to a note rendered as Markdown.",
        initial: "row",
        regions: regions(960, 640, [
            ["list", "ListView", [6, 136, 282, 398]],
            ["search", "GtkSearchEntry", [6, 52, 282, 86]],
            ["filter", "TagFilter", [6, 92, 282, 126]],
            ["row", "NoteRow", [6, 138, 282, 189]],
        ]),
    },
    {
        file: "note-editor.tsx",
        snippet: snippets.noteEditor,
        image: "/notes-editor",
        alt: "Notes editing a Markdown note in GtkSourceView, with highlighted headings, emphasis, links, and front matter.",
        initial: "language",
        regions: regions(960, 640, [
            ["view", "GtkSourceView", [292, 52, 956, 636]],
            ["language", "markdown", [296, 60, 500, 136]],
        ]),
    },
    {
        file: "preferences.tsx",
        snippet: snippets.preferences,
        image: "/figures/tutorial-preferences-and-theming",
        alt: "The Notes preferences dialog: an Appearance group with a Style row and a Storage group with a Notes Folder row.",
        initial: "combo",
        regions: regions(1440, 960, [
            ["dialog", "AdwPreferencesDialog", [80, 174, 1360, 786]],
            ["storage", "AdwPreferencesGroup", [176, 556, 1264, 750]],
            ["combo", "ComboRow", [188, 394, 1252, 502]],
            ["folder", "FolderRow", [188, 630, 1252, 738]],
        ]),
    },
];

const selected = ref(0);
const pinned = ref(EXAMPLES[0].initial);
const hovered = ref<string | null>(null);
const active = computed(() => hovered.value ?? pinned.value);

const tabs = ref<HTMLButtonElement[]>([]);
const panes = ref<HTMLElement | null>(null);

const select = (index: number): void => {
    const next = (index + EXAMPLES.length) % EXAMPLES.length;
    selected.value = next;
    hovered.value = null;
    pinned.value = (EXAMPLES[next] ?? EXAMPLES[0]).initial;
};

const onTabKeydown = (event: KeyboardEvent): void => {
    const moves: Record<string, number> = {
        ArrowRight: selected.value + 1,
        ArrowLeft: selected.value - 1,
        Home: 0,
        End: EXAMPLES.length - 1,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    select(next);
    tabs.value[selected.value]?.focus();
};

const spotOf = (event: Event): string | null =>
    event.target instanceof Element
        ? (event.target.closest<HTMLElement>("[data-spot]")?.dataset.spot ?? null)
        : null;

const onEnter = (event: Event): void => {
    const spot = spotOf(event);
    if (spot !== null) hovered.value = spot;
};

const onLeave = (event: Event): void => {
    if (spotOf(event) !== null) hovered.value = null;
};

const onClick = (event: Event): void => {
    const spot = spotOf(event);
    if (spot !== null) pinned.value = spot;
};

const syncCodeSpots = (): void => {
    for (const spot of panes.value?.querySelectorAll<HTMLElement>("[data-spot]") ?? []) {
        spot.setAttribute("aria-pressed", String(spot.dataset.spot === pinned.value));
        spot.toggleAttribute("data-active", spot.dataset.spot === active.value);
    }
};

watch([pinned, active], syncCodeSpots, { flush: "post" });
onMounted(syncCodeSpots);
</script>

<template>
    <div
        class="stage"
        @pointerover="onEnter"
        @pointerout="onLeave"
        @focusin="onEnter"
        @focusout="onLeave"
        @click="onClick"
    >
        <div class="bar" aria-hidden="true">
            <span class="bar__workspaces"><i /><i /></span>
            <span>Tue 1 Dec&ensp;10:00</span>
            <span class="bar__status">
                <svg viewBox="0 0 16 16"><path d="M2 6.5a9 9 0 0 1 12 0M4.3 9a5.6 5.6 0 0 1 7.4 0M8 12h.01" /></svg>
                <svg viewBox="0 0 16 16"><path d="M3 6.2h2.2L8.2 3.6v8.8L5.2 9.8H3zM10.8 6a3 3 0 0 1 0 4" /></svg>
                <svg viewBox="0 0 16 16"><path d="M8 2.5v5M4.7 4.4a4.8 4.8 0 1 0 6.6 0" /></svg>
            </span>
        </div>
        <div class="desk">
            <div class="editor">
                <div class="editor__tabs" role="tablist" aria-label="Source files" @keydown="onTabKeydown">
                    <button
                        v-for="(e, i) in EXAMPLES"
                        :id="`hero-tab-${i}`"
                        :key="e.file"
                        ref="tabs"
                        type="button"
                        role="tab"
                        class="editor__tab"
                        :aria-selected="i === selected"
                        :aria-controls="`hero-code-${i} hero-window`"
                        :tabindex="i === selected ? 0 : -1"
                        @click="select(i)"
                    >
                        {{ e.file }}
                    </button>
                </div>
                <div ref="panes" class="editor__panes">
                    <div
                        v-for="(e, i) in EXAMPLES"
                        :id="`hero-code-${i}`"
                        :key="e.file"
                        class="editor__code"
                        :class="{ 'editor__code--hidden': i !== selected }"
                        role="tabpanel"
                        :aria-labelledby="`hero-tab-${i}`"
                        v-html="e.snippet.html"
                    />
                </div>
            </div>
            <div id="hero-window" class="window">
                <div v-for="(e, i) in EXAMPLES" v-show="i === selected" :key="e.file" class="window__pane">
                    <img
                        class="window__img window__img--light"
                        :src="`${e.image}-light.png`"
                        width="960"
                        height="640"
                        :loading="i === 0 ? 'eager' : 'lazy'"
                        :alt="e.alt"
                    />
                    <img
                        class="window__img window__img--dark"
                        :src="`${e.image}-dark.png`"
                        width="960"
                        height="640"
                        :loading="i === 0 ? 'eager' : 'lazy'"
                        :alt="e.alt"
                    />
                    <button
                        v-for="r in e.regions"
                        :key="r.id"
                        type="button"
                        class="region"
                        :class="{ 'region--active': active === r.id }"
                        :data-spot="r.id"
                        :aria-label="r.label"
                        :aria-pressed="pinned === r.id"
                        :style="r.style"
                    >
                        <span class="region__tag">{{ r.label }}</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.stage {
  --stage-wall-a: #fbd5d6;
  --stage-wall-b: #f3e9ee;
  --stage-wall-c: #e7e9f2;
  --stage-bar: var(--gray-850);
  --stage-tabs: var(--gray-100);
  --stage-shadow: rgba(40, 16, 20, 0.28);
  --stage-ring: rgba(224, 58, 62, 0.22);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  overflow: hidden;
  background:
    radial-gradient(70% 90% at 8% 0%, var(--stage-wall-a) 0%, transparent 62%),
    radial-gradient(60% 80% at 100% 100%, var(--stage-wall-c) 0%, transparent 70%),
    var(--stage-wall-b);
}
html.dark .stage {
  --stage-wall-a: #5a1218;
  --stage-wall-b: #2a1520;
  --stage-wall-c: #16171f;
  --stage-bar: #0a0a0c;
  --stage-tabs: var(--gray-900);
  --stage-shadow: rgba(0, 0, 0, 0.6);
  --stage-ring: rgba(224, 58, 62, 0.35);
}
.bar {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 0.4rem 0.9rem;
  background: var(--stage-bar);
  color: var(--gray-100);
  font-size: var(--text-xs);
  font-weight: var(--fw-bold);
  line-height: 1.4;
}
.bar__workspaces {
  display: flex;
  align-items: center;
  gap: 5px;
}
.bar__workspaces i {
  display: block;
  width: 7px;
  height: 7px;
  border-radius: var(--radius-pill);
  background: currentColor;
  opacity: 0.45;
}
.bar__workspaces i:first-child {
  width: 26px;
  opacity: 1;
}
.bar__status {
  display: flex;
  justify-content: flex-end;
  gap: 0.7rem;
}
.bar__status svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.desk {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 720px);
  gap: 1.6rem;
  align-items: center;
  padding: 1.9rem;
}
.editor {
  align-self: stretch;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: 0 18px 44px -18px var(--stage-shadow);
}
.editor__tabs {
  display: flex;
  gap: 2px;
  padding: 6px 6px 0;
  background: var(--stage-tabs);
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
}
.editor__tab {
  flex: none;
  margin-bottom: -1px;
  padding: 0.45rem 0.75rem;
  border: 1px solid transparent;
  border-bottom: 0;
  border-radius: 8px 8px 0 0;
  background: transparent;
  color: var(--text-3);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  line-height: 1.5;
  white-space: nowrap;
  cursor: pointer;
  transition: var(--transition-colors);
}
.editor__tab:hover {
  color: var(--text-1);
}
.editor__tab[aria-selected="true"] {
  color: var(--text-1);
  background: var(--code-bg);
  border-color: var(--border);
}
.editor__tab:focus-visible {
  outline-offset: -2px;
}
.editor__panes {
  flex: 1;
  display: grid;
  min-width: 0;
}
.editor__code {
  grid-area: 1 / 1;
  min-width: 0;
}
.editor__code--hidden {
  visibility: hidden;
}
.editor__code :deep(.shiki) {
  height: 100%;
  margin: 0;
  padding: 1rem 1.1rem 1rem 0;
  overflow-x: auto;
  font-family: var(--font-mono);
  font-size: 0.78rem;
  line-height: 1.62;
  counter-reset: line;
}
.editor__code :deep(.shiki:focus-visible) {
  outline-offset: -2px;
}
.editor__code :deep(.shiki code) {
  display: block;
  width: max-content;
  min-width: 100%;
  padding: 0;
  background: none;
  font-size: inherit;
}
.editor__code :deep(.line)::before {
  counter-increment: line;
  content: counter(line);
  display: inline-block;
  width: 2.6em;
  margin-right: 1.1em;
  text-align: right;
  color: var(--text-3);
  opacity: 0.6;
  user-select: none;
}
.editor__code :deep(.spot) {
  margin: 0 -1px;
  padding: 0 1px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  box-shadow: inset 0 0 0 1px var(--stage-ring);
  font: inherit;
  cursor: pointer;
  transition:
    background-color var(--dur-fast) var(--ease-standard),
    box-shadow var(--dur-fast) var(--ease-standard);
}
.editor__code :deep(.spot[data-active]) {
  background: var(--brand-soft);
  box-shadow: inset 0 0 0 1.5px var(--brand);
}
.editor__code :deep(.spot:focus-visible) {
  outline-offset: 1px;
}
.window {
  min-width: 0;
}
.window__pane {
  position: relative;
  aspect-ratio: 3 / 2;
}
.window__img {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  filter: drop-shadow(0 22px 34px var(--stage-shadow));
}
.window__img--dark,
html.dark .window__img--light {
  display: none;
}
html.dark .window__img--dark {
  display: block;
}
.region {
  position: absolute;
  padding: 0;
  border: 0;
  border-radius: 9px;
  background: transparent;
  cursor: pointer;
  transition: box-shadow var(--dur-base) var(--ease-standard);
}
.region--active {
  box-shadow:
    0 0 0 2px var(--brand),
    0 0 0 6px var(--stage-ring);
}
.region__tag {
  position: absolute;
  right: 8px;
  top: -11px;
  display: none;
  padding: 0.25rem 0.45rem;
  border-radius: 5px;
  background: var(--brand-strong);
  color: var(--brand-contrast);
  font-family: var(--font-mono);
  font-size: 0.68rem;
  font-weight: var(--fw-medium);
  line-height: 1;
  white-space: nowrap;
}
.region--active .region__tag {
  display: block;
}
@media (max-width: 1080px) {
  .desk {
    grid-template-columns: minmax(0, 1fr);
    padding: 1.25rem;
  }
  .window {
    order: -1;
    width: 100%;
    max-width: 720px;
    margin-inline: auto;
  }
}
@media (max-width: 560px) {
  .stage {
    border-radius: var(--radius-lg);
  }
  .desk {
    gap: 0.9rem;
    padding: 0.75rem;
  }
  .region__tag {
    right: 4px;
    top: -9px;
    font-size: 0.6rem;
  }
}
</style>
