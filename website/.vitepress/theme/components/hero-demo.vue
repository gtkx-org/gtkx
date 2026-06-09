<script setup lang="ts">
import { ref } from "vue";

const count = ref(0);

const code = [
    '<span class="cm">// app.tsx</span>',
    '<span class="kw">import</span> { <span class="ty">GtkButton</span>, <span class="ty">GtkLabel</span> } <span class="kw">from</span> <span class="st">"@gtkx/react"</span>;',
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
                    <span class="adw-window-dot" />
                    <span class="adw-window-dot" />
                    <span class="adw-window-dot" />
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
