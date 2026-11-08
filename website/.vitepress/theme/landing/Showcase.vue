<script setup lang="ts">
import Icon from "../components/Icon.vue";
import { docsLink } from "./content";

const shots = [
    {
        name: "notes-editor",
        chapter: "tutorial/the-note-editor",
        caption: "Edit a Note",
        alt: "Notes editing a Markdown note in GtkSourceView, with highlighted headings, emphasis, links, and front matter.",
    },
    {
        name: "notes-i18n-fr",
        chapter: "tutorial/internationalization",
        caption: "Translate the App",
        alt: "Notes translated into French in the dark style, showing a French note rendered as Markdown.",
    },
];
</script>

<template>
    <section id="tutorial" class="show">
        <div class="show__head section-head">
            <h2 class="section-title">Build a notes app</h2>
            <p class="section-sub">
                Build Notes one feature at a time: Markdown files, a live preview, search in a worker, and link
                completion. Then test it, translate it, and create installable packages.
            </p>
        </div>
        <div class="show__strip">
            <figure v-for="s in shots" :key="s.name" class="show__shot">
                <a class="show__frame" :href="docsLink(s.chapter)">
                    <img :src="`/${s.name}.png`" width="960" height="640" loading="lazy" :alt="s.alt" />
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
    display: flex;
    gap: 0.75rem;
    margin: 0 calc(-1 * clamp(1rem, 4vw, 2.5rem));
    padding: 0.25rem clamp(1rem, 4vw, 2.5rem) 0.75rem;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scroll-padding-inline: clamp(1rem, 4vw, 2.5rem);
    scrollbar-width: none;
  }
  .show__shot {
    flex: 0 0 86%;
    min-width: 0;
    scroll-snap-align: start;
  }
  .show__frame {
    height: 250px;
  }
  .show__frame img {
    width: 960px;
    max-width: none;
    margin-left: -290px;
  }
}
</style>
