<script setup lang="ts">
import Card from "../components/Card.vue";

const features = [
    {
        icon: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
        title: "Native objects",
        body: "Every GObject-derived class is available as a JSX element. Properties are mapped to JSX elements, so you can compose your entire object graph declaratively."
    },
    {
        icon: "M13 2 3 14h7l-1 8 10-12h-7z",
        title: "Hot reload for desktop",
        body: "Fast Refresh patches the running window as you save. Changes it cannot patch trigger an automatic, supervised restart."
    },
    {
        icon: "M4 17l6-6-6-6M12 19h8",
        title: "Typed end to end",
        body: "Every class, signal, enum and property is generated from GIRs and available to your IDE with full type information."
    },
    {
        icon: "M9 11l3 3 8-8M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
        title: "A React Testing Library for GTK4",
        body: "Query and drive your app in Vitest, with a virtual display running on a headless Wayland compositor."
    },
    {
        icon: "M12 8V4M9 4h6M5 8h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2M9 14h.01M15 14h.01",
        title: "Agentic MCP server",
        body: "A Model Context Protocol (MCP) server exposes your live app to AI agents, enabling testing, debugging and even autonomous development."
    },
    {
        icon: "M4 4h16v16H4zM9 9h6v6H9zM9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3",
        title: "Powered by Rust",
        body: "A native Rust core translates your GLib/GObject calls to the native architecture at runtime."
    },
];
</script>

<template>
  <section id="features" class="features">
    <div class="features__grid">
      <Card v-for="f in features" :key="f.title" interactive glow padding="1.6rem">
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
.features__head {
  margin-bottom: clamp(2rem, 4vw, 3.5rem);
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
