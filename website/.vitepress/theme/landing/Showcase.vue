<script setup lang="ts">
import Icon from "../components/Icon.vue";
import { docsLink } from "./content";

const shots = [
    {
        name: "tasks-forms",
        chapter: "tutorial/the-task-editor",
        caption: "Edit Tasks",
        alt: "The Tasks editor page with a title field, an importance switch, a due date, and notes.",
    },
    {
        name: "tasks-i18n-fr",
        chapter: "tutorial/internationalization",
        caption: "Translate the App",
        alt: "Tasks translated into French in the dark style, showing an empty search result.",
    },
];
</script>

<template>
    <section id="tutorial" class="show">
        <div class="show__head section-head">
            <h2 class="section-title">Build a task manager</h2>
            <p class="section-sub">
                Build Tasks one feature at a time: lists, search, preferences, and reminders. Then test it, translate
                it, and create installable packages.
            </p>
        </div>
        <div class="show__strip">
            <figure v-for="s in shots" :key="s.name" class="show__shot">
                <a class="show__frame" :href="docsLink(s.chapter)">
                    <picture>
                        <source :srcset="`/${s.name}.webp`" type="image/webp" />
                        <img :src="`/${s.name}.png`" width="900" height="600" loading="lazy" :alt="s.alt" />
                    </picture>
                </a>
                <figcaption>
                    <a :href="docsLink(s.chapter)">{{ s.caption }}</a>
                </figcaption>
            </figure>
        </div>
        <p class="show__more">
            <a :href="docsLink('tutorial/')">Follow the tutorial <Icon name="arrow" :size="15" /></a>
        </p>
    </section>
</template>

<style scoped>
.show {
  max-width: var(--container-lg);
  margin: 0 auto;
  padding: clamp(2.5rem, 5vw, 4.5rem) clamp(1rem, 4vw, 2.5rem);
}
.show__head {
  margin-bottom: clamp(1.8rem, 4vw, 2.8rem);
}
.show__strip {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.2rem;
}
.show__shot {
  margin: 0;
}
.show__frame {
  display: block;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  transition: border-color var(--dur-base) var(--ease-standard);
}
.show__frame:hover {
  border-color: var(--brand);
}
.show__frame img {
  display: block;
  width: 100%;
  height: auto;
}
.show__shot figcaption {
  margin-top: 0.7rem;
  font-family: var(--font-body);
  font-size: var(--text-sm);
}
.show__shot figcaption a,
.show__more a {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-weight: var(--fw-semibold);
  color: var(--text-brand);
  text-decoration: none;
  transition: var(--transition-colors);
}
.show__shot figcaption a:hover,
.show__more a:hover {
  color: var(--brand-hover);
}
.show__more {
  margin: 1.6rem 0 0;
  text-align: center;
  font-family: var(--font-body);
}
@media (max-width: 600px) {
  .show__strip {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
