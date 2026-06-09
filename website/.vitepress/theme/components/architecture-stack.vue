<script setup lang="ts">
const layers = [
    { name: "Your app", sub: "JSX intrinsic elements", tone: "paper" },
    { name: "@gtkx/react", sub: "Reconciler", tone: "paper" },
    { name: "@gtkx/ffi", sub: "TypeScript bindings", tone: "paper" },
    { name: "@gtkx/native", sub: "Rust napi-rs · libffi", tone: "ink" },
    { name: "GTK4 · GLib · Adwaita", sub: "Native libraries", tone: "accent" },
];
</script>

<template>
    <section class="gtkx-arch">
        <div class="gtkx-arch-inner">
            <div class="gtkx-arch-intro">
                <div class="gtkx-eyebrow">How it works</div>
                <h2 class="gtkx-arch-title">Five layers, one tree.</h2>
                <p class="gtkx-arch-lead">
                    JSX flows down through the reconciler to typed FFI bindings, into the native module, and out to real
                    GTK4 widgets. Signals travel back up the same path.
                </p>
                <ul class="gtkx-arch-bullets">
                    <li>
                        <b>Type-safe end to end.</b> The FFI layer regenerates from GIR, so widget props are typed by
                        their real GTK definition.
                    </li>
                    <li>
                        <b>HMR everywhere.</b> Vite watches your TSX. Edits land in the running app without losing window
                        state.
                    </li>
                    <li>
                        <b>MCP-aware.</b> The dev server publishes the widget tree so AI agents can inspect and drive it.
                    </li>
                </ul>
                <a class="gtkx-ghost-link" href="/docs/introduction">Read the architecture guide →</a>
            </div>
            <div class="gtkx-arch-stack" aria-hidden="true">
                <div v-for="(layer, index) in layers" :key="layer.name" class="gtkx-arch-layer" :class="`tone-${layer.tone}`">
                    <div class="gtkx-arch-layer-name">{{ layer.name }}</div>
                    <div class="gtkx-arch-layer-sub">{{ layer.sub }}</div>
                    <svg
                        v-if="index < layers.length - 1"
                        class="gtkx-arch-layer-arrow"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <polyline points="19 12 12 19 5 12" />
                    </svg>
                </div>
            </div>
        </div>
    </section>
</template>
