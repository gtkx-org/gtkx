<script setup lang="ts">
import snippets from "virtual:gtkx-snippets";
import Icon from "../components/Icon.vue";
import { docsLink } from "./content";
import WindowClip from "../components/WindowClip.vue";
import WindowShot from "./WindowShot.vue";

const REFRESH_EDIT = ['<GtkBox cssClasses={["card"]}>', "<GtkSeparator orientation={Gtk.Orientation.VERTICAL} />"];

const TOOLS = [
    { name: "gtkx_query_widgets", use: "Find widgets by role, text, accessible name or label" },
    { name: "gtkx_click", use: "Click a widget" },
    { name: "gtkx_take_screenshot", use: "Capture a window as an image, a saved PNG, or both" },
];

const PACKAGES = [
    { file: ".flatpak", use: "A sandboxed application with a GNOME runtime" },
    { file: ".deb", use: "Debian, Ubuntu, and derivatives" },
    { file: ".rpm", use: "Fedora and other RPM distributions" },
    { file: ".AppImage", use: "A downloadable executable file" },
];
</script>

<template>
    <section id="workflow" class="section flow">
        <div class="section__inner">
            <div class="section-head">
                <p class="overline">The workflow</p>
                <h2 class="section-title">From <code>npm create</code> to an installable package</h2>
                <p class="section-sub">
                    Each step uses tools web developers already know, on real GTK and Adwaita widgets.
                </p>
            </div>

            <div class="flow__grid">
                <article class="card card--7">
                    <div class="card__text">
                        <p class="card__verb">Develop</p>
                        <h3 class="card__name">Edits land in the open window</h3>
                        <p class="card__body">
                            Fast Refresh applies most edits to the open window and keeps its state.
                        </p>
                        <a class="more" :href="docsLink('guide/getting-started#the-dev-loop')"
                            >The dev loop <Icon name="arrow" :size="14"
                        /></a>
                    </div>
                    <div class="card__visual wall refresh">
                        <figure class="refresh__edit">
                            <figcaption>src/preview/markdown-preview.tsx</figcaption>
                            <pre><code><span v-for="line in REFRESH_EDIT" :key="line" class="refresh__added">{{ line }}</span></code></pre>
                        </figure>
                        <p class="refresh__note">
                            Saved twice. The code moves into a card, the quote gets its bar, and the note stays open.
                        </p>
                        <WindowClip
                            class="refresh__clip"
                            name="tutorial-fast-refresh"
                            :width="720"
                            :height="480"
                            alt="The Notes window showing Meeting notes as a rendered preview while two edits are saved: the code block moves into a card, then the quote gets a bar beside it."
                        />
                    </div>
                </article>

                <article class="card card--5">
                    <div class="card__text">
                        <p class="card__verb">Develop</p>
                        <h3 class="card__name">Adwaita and GTK widgets as components</h3>
                        <p class="card__body">
                            Lists, tables, dialogs and adaptive layouts are the toolkit's own. React updates them when
                            state changes.
                        </p>
                        <a class="more" :href="docsLink('guide/components')"
                            >Components <Icon name="arrow" :size="14"
                        /></a>
                    </div>
                    <div class="card__visual wall widgets">
                        <WindowShot
                            class="widgets__table"
                            image="/figures/guide-components-column-view"
                            :width="360"
                            :height="260"
                            alt="A window titled ColumnView with a table of four employees in Name and Team columns, sorted by name in ascending order."
                        />
                        <WindowShot
                            class="widgets__narrow"
                            image="/figures/tutorial-an-adaptive-layout"
                            :width="360"
                            :height="480"
                            alt="The Notes window at 360 pixels wide, collapsed to one pane: Website relaunch open in the editor under a header bar with a back button."
                        />
                    </div>
                </article>

                <article class="card card--4">
                    <div class="card__text">
                        <p class="card__verb">Develop</p>
                        <h3 class="card__name">Types for the libraries you add</h3>
                        <p class="card__body">
                            Codegen emits typed props, signals, and methods for each native library, such as WebKitGTK.
                        </p>
                        <a class="more" :href="docsLink('guide/configuration-and-codegen#what-codegen-emits')"
                            >Codegen <Icon name="arrow" :size="14"
                        /></a>
                    </div>
                    <div class="card__visual snips">
                        <p class="snips__file">gtkx.config.ts</p>
                        <div class="snips__code" v-html="snippets.libraries.html" />
                        <p class="snips__file">src/app.tsx</p>
                        <div class="snips__code" v-html="snippets.webView.html" />
                    </div>
                </article>

                <article class="card card--4">
                    <div class="card__text">
                        <p class="card__verb">Develop</p>
                        <h3 class="card__name">Your agent can drive the app</h3>
                        <p class="card__body">
                            The MCP server lets a coding agent inspect the running app, act on it, and check the result.
                        </p>
                        <a class="more" :href="docsLink('guide/mcp')">MCP <Icon name="arrow" :size="14" /></a>
                    </div>
                    <ul class="card__visual tools">
                        <li v-for="tool in TOOLS" :key="tool.name">
                            <code>{{ tool.name }}</code>
                            <span>{{ tool.use }}</span>
                        </li>
                    </ul>
                </article>

                <article class="card card--4 card--split">
                    <div class="card__text">
                        <p class="card__verb">Test</p>
                        <h3 class="card__name">Test the real interface</h3>
                        <p class="card__body">
                            Tests run in Vitest on a private headless display. Find widgets by role and name, click and
                            type, and assert on what the user sees.
                        </p>
                        <a class="more" :href="docsLink('guide/testing')">Testing <Icon name="arrow" :size="14" /></a>
                    </div>
                    <div class="card__visual snips">
                        <p class="snips__file">tests/settings-panel.test.tsx</p>
                        <div class="snips__code" v-html="snippets.test.html" />
                        <p class="snips__file">npm test</p>
                        <pre
                            class="snips__out"
                        ><span class="snips__ok">✓</span> tests/settings-panel.test.tsx (1 test) 30ms</pre>
                    </div>
                </article>

                <article class="card card--12 ship">
                    <div class="card__text">
                        <p class="card__verb">Ship</p>
                        <h3 class="card__name">Package for Linux</h3>
                        <p class="card__body">
                            <code>npm run deploy</code> builds the packages from your configuration and generates the
                            desktop entry and AppStream metadata.
                        </p>
                        <a class="more" :href="docsLink('guide/deploying')"
                            >Deploying <Icon name="arrow" :size="14"
                        /></a>
                    </div>
                    <div class="card__visual ship__visual">
                        <p class="ship__cmd"><span aria-hidden="true">$</span>npm run deploy</p>
                        <ul class="ship__formats">
                            <li v-for="p in PACKAGES" :key="p.file">
                                <code>{{ p.file }}</code>
                                <span>{{ p.use }}</span>
                            </li>
                        </ul>
                    </div>
                </article>
            </div>
        </div>
    </section>
</template>

<style scoped>
.flow__grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 1.25rem;
}
.card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: var(--bg-alt);
}
.card--7 {
  grid-column: span 7;
}
.card--5 {
  grid-column: span 5;
}
.card--4 {
  grid-column: span 4;
}
.card--12 {
  grid-column: span 12;
}
.card__text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 1.6rem 1.75rem 1.5rem;
}
.card__verb {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: var(--tracking-caps);
  text-transform: uppercase;
  color: var(--text-3);
}
.landing .card__name {
  font-size: 1.38rem;
  line-height: 1.2;
}
.card__body {
  margin: 0;
  color: var(--text-2);
}
.card__body code {
  font-size: 0.92em;
  color: var(--text-1);
}
.card .more {
  margin-top: 0.25rem;
  font-size: 0.92rem;
}
.card__visual {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  margin: 0;
  border-top: 1px solid var(--border);
}

.refresh {
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 1.5rem 1.75rem 1.9rem;
}
.refresh__edit {
  align-self: stretch;
  margin: 0;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--code-bg);
  font-family: var(--font-mono);
  font-size: 0.76rem;
  line-height: 1.6;
}
.refresh__edit figcaption {
  padding: 0.45rem 0.9rem;
  border-bottom: 1px solid var(--border);
  color: var(--text-3);
}
.refresh__edit pre {
  margin: 0;
  padding: 0.6rem 0.9rem;
  overflow-x: auto;
}
.refresh__added {
  display: block;
  width: max-content;
  white-space: pre;
  color: var(--syntax-string);
}
.refresh__added::before {
  content: "+ ";
}
.refresh__note {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--text-2);
  text-align: center;
}
.refresh__clip {
  --clip-shadow: 0 16px 26px var(--wall-shadow);
  --clip-max-width: 520px;
}

.widgets {
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 4%;
  padding: 1.9rem 1.75rem;
}
.widgets__table {
  width: 58%;
}
.widgets__narrow {
  width: 36%;
}

.snips {
  padding: 1.1rem 1.75rem 1.4rem;
  background: var(--code-bg);
  font-family: var(--font-mono);
  font-size: 0.76rem;
  line-height: 1.62;
}
.snips__file {
  margin: 0 0 0.25rem;
  color: var(--text-3);
}
.snips__code,
.snips__out {
  margin: 0 0 0.9rem;
}
.snips > :last-child {
  margin-bottom: 0;
}
.snips__code :deep(.shiki) {
  margin: 0;
  overflow-x: auto;
  font-size: inherit;
  line-height: inherit;
}
.snips__code :deep(.shiki code) {
  display: block;
  width: max-content;
  min-width: 100%;
  padding: 0;
  background: none;
  font-size: inherit;
}
.snips__out {
  overflow-x: auto;
  color: var(--text-1);
}
.snips__ok {
  color: var(--syntax-string);
}

.tools {
  padding: 0.9rem 1.75rem 1.25rem;
  list-style: none;
  background: var(--code-bg);
}
.tools li {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding: 0.55rem 0;
  border-bottom: 1px solid var(--border);
}
.tools li:last-child {
  border-bottom: 0;
}
.tools code {
  font-size: 0.78rem;
  color: var(--text-brand);
}
.tools span {
  font-size: 0.86rem;
  color: var(--text-2);
}

.ship {
  flex-direction: row;
}
.ship .card__text {
  flex: 0 0 40%;
  justify-content: center;
}
.ship__visual {
  justify-content: center;
  gap: 1rem;
  padding: 1.5rem 1.75rem;
  border-top: 0;
  border-left: 1px solid var(--border);
  background: var(--code-bg);
}
.ship__cmd {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 0.82rem;
  color: var(--text-1);
}
.ship__cmd span {
  margin-right: 0.5rem;
  color: var(--brand);
}
.ship__formats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem 1.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.ship__formats li {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding-top: 0.6rem;
  border-top: 1px solid var(--border);
}
.ship__formats code {
  font-weight: var(--fw-bold);
  font-size: 0.9rem;
  color: var(--text-1);
}
.ship__formats span {
  font-size: 0.86rem;
  color: var(--text-2);
}

@media (max-width: 1080px) {
  .card--7,
  .card--5 {
    grid-column: span 12;
  }
  .card--4 {
    grid-column: span 6;
  }
}
@media (min-width: 701px) and (max-width: 1080px) {
  .card--split {
    grid-column: span 12;
    flex-direction: row;
  }
  .card--split .card__text {
    flex: 0 0 40%;
    justify-content: center;
  }
  .card--split .card__visual {
    justify-content: center;
    border-top: 0;
    border-left: 1px solid var(--border);
  }
}
@media (max-width: 700px) {
  .card--4 {
    grid-column: span 12;
  }
  .card__text {
    padding: 1.35rem 1.25rem 1.25rem;
  }
  .refresh,
  .widgets,
  .snips,
  .tools,
  .ship__visual {
    padding-inline: 1.25rem;
  }
  .ship {
    flex-direction: column;
  }
  .ship__visual {
    border-top: 1px solid var(--border);
    border-left: 0;
  }
  .ship__formats {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
