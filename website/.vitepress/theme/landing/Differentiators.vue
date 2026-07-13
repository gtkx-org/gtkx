<script setup lang="ts">
import Badge from "../components/Badge.vue";
import CodeBlock from "../components/CodeBlock.vue";

const testCode = `import * as Gtk from "@gtkx/gi/gtk";
import { render, screen, userEvent } from "@gtkx/testing";
import { Counter } from "./Counter";

test("increments on click", async () => {
  render(<Counter />);
  const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON);
  await userEvent.click(button);
  expect(await screen.findByText("Count: 1")).toBeInstanceOf(Gtk.Label);
});`;
</script>

<template>
  <section id="testing" class="diff">
    <div class="diff__head section-head">
      <p class="overline">Two things no JS-desktop tool ships</p>
      <h2 class="diff__title section-title">Tested like the web. <span class="accent">Driveable by agents.</span></h2>
    </div>
    <div class="diff__grid">
      <div class="diff__card">
        <h3 class="diff__name">Test real widgets</h3>
        <p class="diff__body">
          A Testing-Library harness over real GObjects: accessibility-first queries,
          <code class="l-code">userEvent</code> through real GTK controllers, and screenshots, all inside
          React <code class="l-code">act()</code>, on a per-worker headless display.
        </p>
        <CodeBlock title="Counter.test.tsx" :code="testCode" />
      </div>
      <div class="diff__card">
        <div class="diff__name-row">
          <h3 class="diff__name">Drive your app with AI</h3>
          <Badge tone="accent" variant="soft">MCP</Badge>
        </div>
        <p class="diff__body">
          The built-in MCP server bridges a running app to an agent over a socket. Your
          live UI becomes queryable and clickable, the way Playwright MCP drives a browser.
        </p>
        <CodeBlock variant="terminal">
          <div class="mcp-com"># Claude drives your live app over MCP</div>
          <div class="mcp-in"><span aria-hidden="true">→</span> gtkx_query_widgets { by: "role", value: "button" }</div>
          <div class="mcp-out"><span aria-hidden="true">←</span> 2 matches: "Save" (id 12), "Cancel" (id 13)</div>
          <div class="mcp-in"><span aria-hidden="true">→</span> gtkx_click { widgetId: 12 }</div>
          <div class="mcp-ok"><span aria-hidden="true">✓</span> toast "Recipe saved" appeared</div>
        </CodeBlock>
      </div>
    </div>
  </section>
</template>

<style scoped>
.diff {
  max-width: var(--container-lg);
  margin: 0 auto;
  padding: clamp(2.5rem, 5vw, 4.5rem) clamp(1rem, 4vw, 2.5rem);
}
.diff__head {
  max-width: 44rem;
  margin-bottom: clamp(2rem, 4vw, 3rem);
}
.diff__title {
  font-size: clamp(1.8rem, 3.8vw, 2.8rem);
}
.diff__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.4rem;
}
.diff__card {
  min-width: 0;
  padding: clamp(1.4rem, 2.5vw, 1.9rem);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}
.diff__name-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}
.diff__name {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: var(--text-lg);
  margin: 0 0 0.6rem;
  color: var(--text-1);
}
.diff__name-row .diff__name {
  margin-bottom: 0.6rem;
}
.diff__body {
  font-family: var(--font-body);
  font-size: var(--text-sm);
  line-height: 1.6;
  color: var(--text-2);
  margin: 0 0 1.2rem;
}
.mcp-com {
  color: var(--text-3);
}
.mcp-in {
  color: var(--accent);
}
.mcp-out {
  color: rgba(235, 235, 245, 0.7);
}
.mcp-ok {
  color: var(--success);
}
@media (max-width: 860px) {
  .diff__grid {
    grid-template-columns: 1fr;
  }
}
</style>
