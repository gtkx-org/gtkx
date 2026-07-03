<script setup lang="ts">
import { computed, ref } from "vue";

const pm = ref("pnpm");
const CMDS: Record<string, string> = {
    npm: "npm create gtkx@latest",
    pnpm: "pnpm create gtkx",
    yarn: "yarn create gtkx",
    bun: "bun create gtkx",
};
const cmd = computed(() => CMDS[pm.value]);
const pms = [
    { value: "npm", label: "npm" },
    { value: "pnpm", label: "pnpm" },
    { value: "yarn", label: "yarn" },
    { value: "bun", label: "bun" },
];

type Tok = { t: string; c?: string };
const code: { indent?: number; toks: Tok[] }[] = [
    {
        toks: [
            { c: "kw", t: "import" },
            { t: " { createRoot } " },
            { c: "kw", t: "from" },
            { t: " " },
            { c: "str", t: '"@gtkx/react"' },
        ],
    },
    {
        toks: [
            { c: "kw", t: "import" },
            { t: " { " },
            { c: "tag", t: "AdwApplication, AdwApplicationWindow, AdwHeaderBar" },
            { t: " } " },
            { c: "kw", t: "from" },
            { t: " " },
            { c: "str", t: '"@gtkx/jsx/adw"' },
        ],
    },
    {
        toks: [
            { c: "kw", t: "import" },
            { t: " { " },
            { c: "tag", t: "GtkLabel" },
            { t: " } " },
            { c: "kw", t: "from" },
            { t: " " },
            { c: "str", t: '"@gtkx/jsx/gtk"' },
        ],
    },
    {
        toks: [
            { c: "kw", t: "import" },
            { t: " { applicationId } " },
            { c: "kw", t: "from" },
            { t: " " },
            { c: "str", t: '"virtual:gtkx-config"' },
        ],
    },
    { toks: [] },
    { toks: [{ c: "kw", t: "function" }, { t: " " }, { c: "fn", t: "App" }, { t: "() {" }] },
    { indent: 1, toks: [{ c: "kw", t: "return" }, { t: " (" }] },
    {
        indent: 2,
        toks: [
            { c: "punct", t: "<" },
            { c: "tag", t: "AdwApplication" },
            { t: " applicationId={applicationId}" },
            { c: "punct", t: ">" },
        ],
    },
    {
        indent: 3,
        toks: [
            { c: "punct", t: "<" },
            { c: "tag", t: "AdwApplicationWindow" },
            { t: " title=" },
            { c: "str", t: '"Recipes"' },
            { c: "punct", t: ">" },
        ],
    },
    { indent: 4, toks: [{ c: "punct", t: "<" }, { c: "tag", t: "AdwHeaderBar" }, { t: " />" }] },
    {
        indent: 4,
        toks: [
            { c: "punct", t: "<" },
            { c: "tag", t: "GtkLabel" },
            { t: " label=" },
            { c: "str", t: '"Hello from React 👋"' },
            { t: " />" },
        ],
    },
    {
        indent: 3,
        toks: [
            { c: "punct", t: "</" },
            { c: "tag", t: "AdwApplicationWindow" },
            { c: "punct", t: ">" },
        ],
    },
    {
        indent: 2,
        toks: [
            { c: "punct", t: "</" },
            { c: "tag", t: "AdwApplication" },
            { c: "punct", t: ">" },
        ],
    },
    { indent: 1, toks: [{ t: ")" }] },
    { toks: [{ t: "}" }] },
    { toks: [] },
    {
        toks: [
            { c: "fn", t: "createRoot" },
            { t: "()." },
            { c: "fn", t: "render" },
            { t: "(" },
            { c: "punct", t: "<" },
            { c: "tag", t: "App" },
            { t: " />)" },
        ],
    },
];
</script>

<template>
  <section id="top" class="hero">
    <span class="glow" />
    <div class="hero__grid stack-md">
      <div class="hero__col">
        <p class="overline hero__eyebrow">// React · GTK4 · libadwaita · TypeScript</p>
        <h1 class="hero__title">
          Linux desktop application development for the
          <span class="gtkx-gradient-text">modern age</span>
        </h1>
        <p class="hero__lede">
          Write declarative JSX. GTKX renders real native
          <strong>GTK4 &amp; libadwaita</strong> widgets — no webview, no Electron —
          backed by a Rust GObject runtime.
        </p>
        <div class="hero__cta">
          <Button size="lg" href="#install">
            Get started
            <template #icon-right><Icon name="arrow" :size="17" /></template>
          </Button>
          <Button size="lg" variant="secondary" :href="REPO_URL">
            <template #icon-left><Icon name="github" /></template>
            View on GitHub
          </Button>
        </div>
        <div id="install" class="hero__install">
          <Tabs v-model="pm" variant="pill" :items="pms" />
          <CodeBlock variant="terminal" :code="cmd" />
          <p class="hero__note">
            Scaffolds a typed GTK4 + React app with HMR, testing, and production bundling wired up.
          </p>
        </div>
      </div>
      <div class="hero__col hero__visual">
        <CodeBlock title="src/App.tsx">
          <div class="hero__code">
            <div v-for="(ln, i) in code" :key="i" class="hcl" :style="{ paddingLeft: `${(ln.indent ?? 0) * 1.3}em` }">
              <span v-if="!ln.toks.length">&nbsp;</span>
              <span v-for="(tk, j) in ln.toks" :key="j" :class="tk.c ? `tok-${tk.c}` : undefined">{{ tk.t }}</span>
            </div>
          </div>
        </CodeBlock>
      </div>
    </div>
  </section>
</template>

<style scoped>
.hero {
  position: relative;
  overflow: hidden;
  padding: clamp(3rem, 9vw, 7rem) clamp(1rem, 4vw, 2.5rem) clamp(2rem, 5vw, 4rem);
}
.hero__grid {
  position: relative;
  z-index: 1;
  max-width: var(--container-lg);
  margin: 0 auto;
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
  margin: 1.4rem 0 2rem;
  max-width: 32rem;
}
.hero__lede strong {
  color: var(--text-1);
  font-weight: 600;
}
.hero__cta {
  display: flex;
  gap: 0.8rem;
  flex-wrap: wrap;
  margin-bottom: 2rem;
}
.hero__install {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  max-width: 27rem;
}
.hero__note {
  font-family: var(--font-body);
  font-size: var(--text-xs);
  color: var(--text-3);
  margin: 0.1rem 0 0;
  line-height: 1.5;
}
.hero__visual {
  position: relative;
}
.hero__code {
  font-size: var(--text-sm);
  line-height: 1.7;
  white-space: pre;
}
.hcl {
  min-height: 1.7em;
}
@media (max-width: 860px) {
  .hero__visual {
    order: -1;
  }
}
</style>
