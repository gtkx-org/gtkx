<script setup lang="ts">
import { ref } from "vue";

const count = ref(0);

const code = [
    '<span class="cm">// app.tsx</span>',
    '<span class="kw">import</span> { <span class="ty">GtkBox</span>, <span class="ty">GtkButton</span>, <span class="ty">GtkLabel</span> } <span class="kw">from</span> <span class="st">"@gtkx/jsx/gtk"</span>;',
    '<span class="kw">import</span> { useState } <span class="kw">from</span> <span class="st">"react"</span>;',
    "",
    '<span class="kw">export const</span> <span class="fn">App</span> = () =&gt; {',
    '  <span class="kw">const</span> [count, setCount] = <span class="fn">useState</span>(<span class="nu">0</span>);',
    '  <span class="kw">return</span> (',
    '    &lt;<span class="ty">GtkBox</span> <span class="pr">spacing</span>={<span class="nu">12</span>}&gt;',
    '      &lt;<span class="ty">GtkLabel</span> <span class="pr">label</span>={<span class="st">`Count: ${count}`</span>} /&gt;',
    '      &lt;<span class="ty">GtkButton</span> <span class="pr">label</span>=<span class="st">"Increment"</span>',
    '        <span class="pr">onClicked</span>={() =&gt; <span class="fn">setCount</span>(c =&gt; c + <span class="nu">1</span>)} /&gt;',
    '    &lt;/<span class="ty">GtkBox</span>&gt;',
    "  );",
    "};",
].join("\n");
</script>

<template>
    <div class="gtkx-herodemo">
        <pre class="gtkx-hero-code"><code v-html="code" /></pre>
        <div class="gtkx-hero-arrow" aria-hidden="true">
            <div class="gtkx-hero-arrow-line" />
            <div class="gtkx-hero-arrow-tag">renders to</div>
        </div>
        <div class="adw-window" role="img" aria-label="Native GTK4 window output">
            <div class="adw-window-header">
                <div class="adw-window-title">Hello GTKX</div>
                <div class="adw-window-controls">
                    <span class="adw-window-control" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="9" height="9" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="5" y1="19" x2="19" y2="19" /></svg>
                    </span>
                    <span class="adw-window-control" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="1" /></svg>
                    </span>
                    <span class="adw-window-control" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="9" height="9" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
                    </span>
                </div>
            </div>
            <div class="adw-window-body">
                <div class="adw-window-welcome">Welcome to GTKX!</div>
                <div class="adw-window-count">Count: {{ count }}</div>
                <button type="button" class="adw-window-cta" @click="count++">Increment</button>
            </div>
        </div>
    </div>
</template>
