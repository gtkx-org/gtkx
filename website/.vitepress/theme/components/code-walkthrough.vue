<script setup lang="ts">
import { ref } from "vue";

interface Tab {
    id: string;
    label: string;
    note: string;
    code: string;
}

const tabs: Tab[] = [
    {
        id: "build",
        label: "Build",
        note: "Props are GTK properties. onClicked is the real clicked signal. HMR keeps window state while you edit.",
        code: [
            '<span class="cm">// src/app.tsx</span>',
            '<span class="kw">import</span> * <span class="kw">as</span> <span class="ty">Gtk</span> <span class="kw">from</span> <span class="st">"@gtkx/gi/gtk"</span>;',
            '<span class="kw">import</span> { <span class="ty">GtkApplicationWindow</span>, <span class="ty">GtkBox</span>, <span class="ty">GtkButton</span>, <span class="ty">GtkLabel</span> } <span class="kw">from</span> <span class="st">"@gtkx/jsx/gtk"</span>;',
            '<span class="kw">import</span> { quit } <span class="kw">from</span> <span class="st">"@gtkx/react"</span>;',
            '<span class="kw">import</span> { useState } <span class="kw">from</span> <span class="st">"react"</span>;',
            "",
            '<span class="kw">const</span> <span class="fn">MainWindow</span> = () =&gt; {',
            '    <span class="kw">const</span> [count, setCount] = <span class="fn">useState</span>(<span class="nu">0</span>);',
            "",
            '    <span class="kw">return</span> (',
            '        &lt;<span class="ty">GtkApplicationWindow</span> <span class="pr">title</span>=<span class="st">"My App"</span> <span class="pr">onCloseRequest</span>={() =&gt; (<span class="fn">quit</span>(), <span class="kw">true</span>)}&gt;',
            '            &lt;<span class="ty">GtkBox</span> <span class="pr">orientation</span>={<span class="ty">Gtk</span>.<span class="ty">Orientation</span>.<span class="nu">VERTICAL</span>} <span class="pr">spacing</span>={<span class="nu">20</span>}&gt;',
            '                &lt;<span class="ty">GtkLabel</span> <span class="pr">label</span>={<span class="st">`Count: ${count}`</span>} <span class="pr">cssClasses</span>={[<span class="st">"title-2"</span>]} /&gt;',
            '                &lt;<span class="ty">GtkButton</span> <span class="pr">label</span>=<span class="st">"Increment"</span> <span class="pr">onClicked</span>={() =&gt; <span class="fn">setCount</span>((c) =&gt; c + <span class="nu">1</span>)} /&gt;',
            '            &lt;/<span class="ty">GtkBox</span>&gt;',
            '        &lt;/<span class="ty">GtkApplicationWindow</span>&gt;',
            "    );",
            "};",
        ].join("\n"),
    },
    {
        id: "style",
        label: "Style",
        note: "Emotion syntax, compiled to GTK CSS at runtime — nesting, interpolation, and Adwaita named colors.",
        code: [
            '<span class="cm">// src/note-card.tsx</span>',
            '<span class="kw">import</span> { css } <span class="kw">from</span> <span class="st">"@gtkx/css"</span>;',
            "",
            '<span class="kw">const</span> card = <span class="fn">css</span><span class="st">`</span>',
            '<span class="st">    background: @card_bg_color;</span>',
            '<span class="st">    border-radius: 12px;</span>',
            '<span class="st">    padding: 16px;</span>',
            "",
            '<span class="st">    &amp;:hover {</span>',
            '<span class="st">        box-shadow: 0 2px 8px alpha(black, 0.2);</span>',
            '<span class="st">    }</span>',
            '<span class="st">`</span>;',
            "",
            '&lt;<span class="ty">GtkBox</span> <span class="pr">cssClasses</span>={[card]}&gt;…&lt;/<span class="ty">GtkBox</span>&gt;',
        ].join("\n"),
    },
    {
        id: "test",
        label: "Test",
        note: "Runs against real widgets under Xvfb — accessibility-first queries, real signals, no mocks.",
        code: [
            '<span class="cm">// tests/app.test.tsx</span>',
            '<span class="kw">import</span> * <span class="kw">as</span> <span class="ty">Gtk</span> <span class="kw">from</span> <span class="st">"@gtkx/gi/gtk"</span>;',
            '<span class="kw">import</span> { render, screen, userEvent } <span class="kw">from</span> <span class="st">"@gtkx/testing"</span>;',
            '<span class="kw">import</span> { expect, it } <span class="kw">from</span> <span class="st">"vitest"</span>;',
            '<span class="kw">import</span> { <span class="ty">App</span> } <span class="kw">from</span> <span class="st">"../src/app.js"</span>;',
            "",
            '<span class="fn">it</span>(<span class="st">"increments the counter"</span>, <span class="kw">async</span> () =&gt; {',
            '    <span class="kw">await</span> <span class="fn">render</span>(&lt;<span class="ty">App</span> /&gt;, { <span class="pr">wrapper</span>: <span class="kw">false</span> });',
            "",
            '    <span class="kw">const</span> button = <span class="kw">await</span> screen.<span class="fn">findByRole</span>(<span class="ty">Gtk</span>.<span class="ty">AccessibleRole</span>.<span class="nu">BUTTON</span>, { <span class="pr">name</span>: <span class="st">"Increment"</span> });',
            '    <span class="kw">await</span> userEvent.<span class="fn">click</span>(button);',
            "",
            '    <span class="fn">expect</span>(<span class="kw">await</span> screen.<span class="fn">findByText</span>(<span class="st">"Count: 1"</span>)).toBeDefined();',
            "});",
        ].join("\n"),
    },
];

const active = ref(tabs[0].id);
const activeTab = () => tabs.find((tab) => tab.id === active.value) ?? tabs[0];
</script>

<template>
    <section class="gtkx-walkthrough">
        <div class="gtkx-walkthrough-inner">
            <div class="gtkx-eyebrow">The modern age part</div>
            <h2 class="gtkx-section-title">Your toolchain already works here.</h2>
            <p class="gtkx-section-lead">
                React for the UI, TypeScript end to end, Vite for hot reload, Vitest for tests. GTKX points the stack
                you already use at the Linux desktop.
            </p>
            <div class="gtkx-walkthrough-tabs" role="tablist" aria-label="Code walkthrough">
                <button
                    v-for="tab in tabs"
                    :key="tab.id"
                    type="button"
                    role="tab"
                    class="gtkx-walkthrough-tab"
                    :class="{ active: active === tab.id }"
                    :aria-selected="active === tab.id"
                    @click="active = tab.id"
                >
                    {{ tab.label }}
                </button>
            </div>
            <div class="gtkx-walkthrough-panel" role="tabpanel">
                <pre class="gtkx-hero-code gtkx-walkthrough-code"><code v-html="activeTab().code" /></pre>
                <div class="gtkx-walkthrough-note">{{ activeTab().note }}</div>
            </div>
        </div>
    </section>
</template>
