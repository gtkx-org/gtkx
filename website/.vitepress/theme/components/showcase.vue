<script setup lang="ts">
const shots = [
    {
        name: "gtk-demo",
        light: "/media/gtk-demo-light.webp",
        dark: "/media/gtk-demo-dark.webp",
        alt: "The GTK Demo application rebuilt with GTKX",
        caption: "The official GTK4 demo, rebuilt in React — every page a GTKX component tree.",
        wide: true,
    },
    {
        name: "notes",
        light: "/media/notes-light.webp",
        dark: "/media/notes-dark.webp",
        alt: "The tutorial Notes app with an adaptive split view",
        caption: "Adaptive Libadwaita layouts from the tutorial — split views, dialogs, preferences.",
        wide: false,
    },
    {
        name: "browser",
        light: "/media/browser-light.webp",
        dark: "/media/browser-dark.webp",
        alt: "A WebKit browser built with GTKX",
        caption: "Need a webview? In GTKX it's just another widget — never your runtime.",
        wide: false,
    },
];
</script>

<template>
    <section class="gtkx-showcase">
        <div class="gtkx-showcase-inner">
            <div class="gtkx-eyebrow">Real pixels</div>
            <h2 class="gtkx-section-title">This is GTK, not a webview.</h2>
            <p class="gtkx-section-lead">
                Everything below is drawn by GTK4 itself, captured from running GTKX apps. The complete widget catalog,
                GNOME's Libadwaita design language, and your app's windows are all the real thing — in light and dark.
            </p>
            <figure class="gtkx-showcase-video">
                <video autoplay loop muted playsinline preload="metadata" poster="/media/hero-demo-poster.webp">
                    <source src="/media/hero-demo.webm" type="video/webm" />
                    <source src="/media/hero-demo.mp4" type="video/mp4" />
                </video>
                <figcaption>
                    A GTKX-built editor saves two style edits; Vite Fast Refresh repaints the running Notes app without
                    losing state.
                </figcaption>
            </figure>
            <div class="gtkx-showcase-grid">
                <figure
                    v-for="shot in shots"
                    :key="shot.name"
                    class="gtkx-showcase-card"
                    :class="{ 'gtkx-showcase-wide': shot.wide }"
                >
                    <div class="gtkx-shot">
                        <img class="light-only" :src="shot.light" :alt="shot.alt" loading="lazy" decoding="async" />
                        <img class="dark-only" :src="shot.dark" :alt="shot.alt" loading="lazy" decoding="async" />
                    </div>
                    <figcaption>{{ shot.caption }}</figcaption>
                </figure>
            </div>
        </div>
    </section>
</template>
