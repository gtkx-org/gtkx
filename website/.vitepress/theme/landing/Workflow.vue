<script setup lang="ts">
import snippets from "virtual:gtkx-snippets";
import CodeBlock from "../components/CodeBlock.vue";
import Icon from "../components/Icon.vue";
import { CREATE_COMMAND, docsLink } from "./content";

const SCAFFOLD = `${CREATE_COMMAND}\ncd my-app\nnpm run dev`;
</script>

<template>
    <section id="workflow" class="flow">
        <div class="flow__head section-head">
            <p class="overline">The workflow</p>
            <h2 class="section-title">From <code>npm create</code> to an installable package</h2>
            <p class="section-sub">
                Each step uses tools web developers already know, on real GTK and Adwaita widgets.
            </p>
        </div>

        <ol class="flow__steps">
            <li class="step">
                <span class="step__num" aria-hidden="true">01</span>
                <div class="step__text">
                    <p class="step__verb">Create</p>
                    <h3 class="step__name">Scaffold a project</h3>
                    <p class="step__body">
                        The scaffolder sets up an Adwaita application window, TypeScript, and tests.
                        <code>npm run dev</code> opens the app.
                    </p>
                    <div class="step__links">
                        <a :href="docsLink('guide/getting-started')"
                            >Getting Started <Icon name="arrow" :size="14"
                        /></a>
                        <a :href="docsLink('guide/scaffold-options')"
                            >Scaffold Options <Icon name="arrow" :size="14"
                        /></a>
                    </div>
                </div>
                <div class="step__visual">
                    <CodeBlock variant="terminal" title="Terminal" :code="SCAFFOLD" />
                </div>
            </li>

            <li class="step">
                <span class="step__num" aria-hidden="true">02</span>
                <div class="step__text">
                    <p class="step__verb">Develop</p>
                    <h3 class="step__name">Write native widgets in JSX</h3>
                    <ul class="step__list">
                        <li><b>Adwaita and GTK widgets</b> as components; React updates them when state changes.</li>
                        <li><b>Fast Refresh</b> applies most edits to the open window and keeps its state.</li>
                        <li>
                            <b>Generated types</b> for the native libraries you add, such as WebKitGTK: props, signals,
                            and methods.
                        </li>
                        <li><b>Node.js and npm</b>: read files, make requests, and use packages such as Zod.</li>
                        <li><b>MCP</b> lets your coding agent inspect and drive the running app.</li>
                    </ul>
                    <div class="step__links">
                        <a :href="docsLink('guide/getting-started#the-dev-loop')"
                            >The dev loop <Icon name="arrow" :size="14"
                        /></a>
                        <a :href="docsLink('guide/configuration-and-codegen#what-codegen-emits')"
                            >Codegen <Icon name="arrow" :size="14"
                        /></a>
                        <a :href="docsLink('guide/mcp')">MCP <Icon name="arrow" :size="14" /></a>
                    </div>
                </div>
                <div class="step__visual">
                    <CodeBlock title="src/app.tsx" :snippet="snippets.app" />
                </div>
            </li>

            <li class="step">
                <span class="step__num" aria-hidden="true">03</span>
                <div class="step__text">
                    <p class="step__verb">Test</p>
                    <h3 class="step__name">Test the real interface</h3>
                    <p class="step__body">
                        Tests run in Vitest on a private headless display. Find widgets by role and name, click and
                        type, and assert on what the user sees.
                    </p>
                    <div class="step__links">
                        <a :href="docsLink('guide/testing')">Testing <Icon name="arrow" :size="14" /></a>
                    </div>
                </div>
                <div class="step__visual">
                    <CodeBlock title="tests/settings-panel.test.tsx" :snippet="snippets.test" />
                </div>
            </li>

            <li class="step">
                <span class="step__num" aria-hidden="true">04</span>
                <div class="step__text">
                    <p class="step__verb">Ship</p>
                    <h3 class="step__name">Package for Linux</h3>
                    <p class="step__body">
                        <code>npm run deploy</code> builds Flatpak, Debian, RPM, and AppImage packages from your
                        configuration, and generates the desktop entry and AppStream metadata.
                    </p>
                    <div class="step__links">
                        <a :href="docsLink('guide/deploying')">Deploying <Icon name="arrow" :size="14" /></a>
                    </div>
                </div>
                <div class="step__visual">
                    <CodeBlock title="gtkx.config.ts" :snippet="snippets.deploy" />
                </div>
            </li>
        </ol>
    </section>
</template>

<style scoped>
.flow {
  max-width: var(--container-lg);
  margin: 0 auto;
  padding: clamp(2.5rem, 5vw, 4.5rem) clamp(1rem, 4vw, 2.5rem);
}
.flow__head {
  margin-bottom: clamp(1.8rem, 4vw, 2.8rem);
}
.flow__head code {
  font-family: var(--font-mono);
  font-size: 0.8em;
}
.flow__steps {
  list-style: none;
  margin: 0;
  padding: 0;
}
.step {
  display: grid;
  grid-template-columns: 4.5rem minmax(0, 1fr) minmax(0, 1.15fr);
  gap: clamp(1.2rem, 3vw, 2.5rem);
  align-items: start;
  padding: clamp(1.6rem, 3vw, 2.4rem) 0;
  border-top: 1px solid var(--border);
}
.step:last-child {
  border-bottom: 1px solid var(--border);
}
.step__num {
  font-family: var(--font-display);
  font-weight: 900;
  font-size: 2.6rem;
  line-height: 1;
  background: var(--gradient-text);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.step__verb {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: var(--tracking-caps);
  text-transform: uppercase;
  color: var(--text-brand);
  margin: 0 0 0.4rem;
}
.step__name {
  font-family: var(--font-display);
  font-weight: var(--fw-extrabold);
  font-size: clamp(1.4rem, 2.4vw, 1.8rem);
  letter-spacing: -0.02em;
  margin: 0 0 0.7rem;
  color: var(--text-1);
}
.step__body {
  font-family: var(--font-body);
  font-size: var(--text-md);
  line-height: 1.6;
  color: var(--text-2);
  margin: 0 0 0.9rem;
}
.step__body code,
.step__list code {
  font-family: var(--font-mono);
  font-size: 0.9em;
}
.step__list {
  list-style: none;
  padding: 0;
  margin: 0 0 1rem;
  display: grid;
  gap: 0.45rem;
}
.step__list li {
  position: relative;
  padding-left: 1.2rem;
  font-family: var(--font-body);
  font-size: var(--text-sm);
  line-height: 1.5;
  color: var(--text-2);
}
.step__list li::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0.5em;
  width: 7px;
  height: 7px;
  border-radius: 2px;
  background: var(--brand-strong);
}
.step__list b {
  color: var(--text-1);
  font-weight: var(--fw-semibold);
}
.step__links {
  display: flex;
  gap: 1.1rem;
  flex-wrap: wrap;
}
.step__links a {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: var(--fw-semibold);
  color: var(--text-brand);
  text-decoration: none;
  transition: var(--transition-colors);
}
.step__links a:hover {
  color: var(--brand-hover);
}
.step__visual {
  min-width: 0;
}
@media (max-width: 960px) {
  .step {
    grid-template-columns: 3.2rem minmax(0, 1fr);
  }
  .step__visual {
    grid-column: 2;
  }
}
@media (max-width: 560px) {
  .step {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.8rem;
  }
  .step__visual {
    grid-column: auto;
  }
  .step__num {
    font-size: 2rem;
  }
}
</style>
