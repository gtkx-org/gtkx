<script setup lang="ts">
import Icon from "../components/Icon.vue";
</script>

<template>
  <section id="tutorial" class="show">
    <div class="show__head section-head">
      <h2 class="show__title section-title">A comprehensive tutorial</h2>
      <p class="section-sub">
        The docs walk you through creating Tasks, a complete GNOME app: adaptive split view, GSettings,
        notifications, and shipped as a Flatpak.
      </p>
    </div>
    <a class="show__frame" href="/tutorial/">
      <picture>
        <source srcset="/tasks-screenshot.webp" type="image/webp" />
        <img
          src="/tasks-screenshot.png"
          width="900"
          height="600"
          loading="lazy"
          alt="The Tasks app built in the tutorial: an adaptive Adwaita window with a sidebar of smart views and colored lists next to a boxed task list."
        />
      </picture>
      <span class="show__cta">Follow the tutorial <Icon name="arrow" :size="15" /></span>
    </a>
  </section>
</template>

<style scoped>
.show {
  max-width: var(--container-md);
  margin: 0 auto;
  padding: clamp(2.5rem, 5vw, 4rem) clamp(1rem, 4vw, 2.5rem);
}
.show__head {
  margin-bottom: clamp(1.8rem, 4vw, 2.6rem);
}
.show__title {
  font-size: clamp(1.7rem, 3.6vw, 2.6rem);
}
.show__frame {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  text-decoration: none;
}
.show__frame img {
  display: block;
  width: 100%;
  height: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
}
.show__cta {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: var(--fw-semibold);
  color: var(--text-brand);
  transition: var(--transition-colors);
  padding: 0.55rem 0;
}
.show__frame:hover .show__cta {
  color: var(--brand-hover);
}
</style>
