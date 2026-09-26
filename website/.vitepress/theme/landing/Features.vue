<script setup lang="ts">
import Card from "../components/Card.vue";

const features = [
    {
        icon: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
        title: "Native widgets in JSX",
        body: "Build windows, dialogs, and adaptive layouts with Adwaita and GTK widgets. React updates them when your state changes."
    },
    {
        icon: "M13 2 3 14h7l-1 8 10-12h-7z",
        title: "Hot reload for desktop",
        body: "Save a component to update the open window. Changes that need a restart relaunch the app automatically."
    },
    {
        icon: "M4 17l6-6-6-6M12 19h8",
        title: "Types for your native libraries",
        body: "Generate bindings from the libraries installed on your machine. Your editor checks widget props, signals, and native calls."
    },
    {
        icon: "M9 11l3 3 8-8M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
        title: "Test native apps",
        body: "Find widgets by role and name, click buttons, and type into fields in Vitest. Tests run on a private headless display."
    },
    {
        icon: "M12 8V4M9 4h6M5 8h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2M9 14h.01M15 14h.01",
        title: "Inspect from your coding agent",
        body: "Connect through MCP to inspect widgets, interact with your app, take screenshots, and look up the project's generated APIs."
    },
    {
        icon: "M4 4h16v16H4zM9 9h6v6H9zM9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3",
        title: "Package your app",
        body: "Build Flatpak, Debian, RPM, and AppImage packages. The CLI generates desktop entries and application metadata from your configuration."
    },
];
</script>

<template>
  <section id="features" class="features">
    <div class="features__grid">
      <Card v-for="f in features" :key="f.title">
        <span class="features__icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path :d="f.icon" />
          </svg>
        </span>
        <h3 class="features__name">{{ f.title }}</h3>
        <p class="features__body">{{ f.body }}</p>
      </Card>
    </div>
  </section>
</template>

<style scoped>
.features {
  max-width: var(--container-lg);
  margin: 0 auto;
  padding: clamp(2.5rem, 5vw, 4.5rem) clamp(1rem, 4vw, 2.5rem);
}
.features__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}
.features__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  background: var(--brand-soft);
  color: var(--brand);
  margin-bottom: 1.1rem;
}
.features__name {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: var(--text-lg);
  margin: 0 0 0.5rem;
  color: var(--text-1);
}
.features__body {
  font-family: var(--font-body);
  font-size: var(--text-sm);
  line-height: 1.55;
  color: var(--text-2);
  margin: 0;
}
@media (max-width: 960px) {
  .features__grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 600px) {
  .features__grid {
    grid-template-columns: 1fr;
  }
}
</style>
