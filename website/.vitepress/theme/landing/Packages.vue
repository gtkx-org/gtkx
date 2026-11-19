<script setup lang="ts">
import { docsLink } from "./content";

const PACKAGES = [
    { name: "@gtkx/navigation", guide: "guide/navigation", use: "React Navigation navigators for GTK and Adwaita apps." },
    { name: "@gtkx/forms", guide: "guide/forms", use: "React Hook Form controls for GTK and Adwaita apps." },
    {
        name: "@gtkx/i18n",
        guide: "guide/internationalization",
        use: "Gettext localization for GTK apps through react-i18next.",
    },
    { name: "@gtkx/css", guide: "guide/css", use: "CSS-in-JS styling for GTK widgets in GTKX." },
    {
        name: "@gtkx/components",
        guide: "guide/components",
        use: "GTK collection views, selection controls, and toasts for React.",
    },
    { name: "@gtkx/cairo", guide: "guide/cairo", use: "Cairo drawing for GTK apps built with GTKX." },
    {
        name: "@gtkx/storybook",
        guide: "guide/storybook",
        use: "Native Adwaita explorer for Storybook stories of GTKX components.",
    },
    { name: "@gtkx/testing", guide: "guide/testing", use: "Test GTKX apps against real GTK widgets." },
];
</script>

<template>
    <section id="packages" class="section section--joined">
        <div class="section__inner">
            <div class="section-head">
                <p class="overline">Packages</p>
                <h2 class="section-title">The rest of the app</h2>
                <p class="section-sub">
                    Packages for navigation, forms, translation, styling, drawing, and testing. Several build on
                    libraries you may already use: React Navigation, React Hook Form, react-i18next, and Storybook.
                </p>
            </div>
            <ul class="pkgs">
                <li v-for="p in PACKAGES" :key="p.name">
                    <a :href="docsLink(p.guide)">
                        <code>{{ p.name }}</code>
                        <span>{{ p.use }}</span>
                    </a>
                </li>
            </ul>
        </div>
    </section>
</template>

<style scoped>
.pkgs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0 1.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.pkgs a {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  height: 100%;
  padding: 1rem 0 1.4rem;
  border-top: 1px solid var(--border-strong);
}
.pkgs code {
  font-size: 0.86rem;
  font-weight: var(--fw-medium);
  color: var(--text-1);
  transition: var(--transition-colors);
}
.pkgs a:hover code {
  color: var(--text-brand);
}
.pkgs span {
  font-size: 0.9rem;
  color: var(--text-2);
}
@media (max-width: 1080px) {
  .pkgs {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 560px) {
  .pkgs {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
