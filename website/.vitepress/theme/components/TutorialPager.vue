<script setup lang="ts">
import { useTutorialPosition } from "../composables/use-tutorial-position";

const position = useTutorialPosition();
</script>

<template>
    <nav
        v-if="position && (position.previous || position.next)"
        class="tutorial-pager"
        aria-labelledby="tutorial-pager-label"
    >
        <span id="tutorial-pager-label" class="visually-hidden">Pager</span>
        <div class="slot">
            <a v-if="position.previous" class="link" :href="position.previous.link">
                <span class="desc">{{ position.previous.label }}</span>
                <span class="title"><bdi>{{ position.previous.text }}</bdi></span>
            </a>
        </div>
        <div class="slot">
            <a v-if="position.next" class="link next" :href="position.next.link">
                <span class="desc">{{ position.next.label }}</span>
                <span class="title"><bdi>{{ position.next.text }}</bdi></span>
            </a>
        </div>
    </nav>
</template>

<style scoped>
.tutorial-pager {
    display: grid;
    grid-row-gap: 0.5rem;
    border-top: 1px solid var(--vp-c-divider);
    padding-top: 1.5rem;
}

@media (min-width: 40rem) {
    .tutorial-pager {
        grid-template-columns: repeat(2, 1fr);
        grid-column-gap: 1rem;
    }
}

.link {
    display: block;
    border: 1px solid var(--vp-c-divider);
    border-radius: 0.5rem;
    padding: 0.6875rem 1rem 0.8125rem;
    width: 100%;
    height: 100%;
    transition: border-color 0.25s;
}

.link:hover {
    border-color: var(--vp-c-brand-1);
}

.link.next {
    text-align: end;
}

.desc {
    display: block;
    line-height: 1.6666667;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--vp-c-text-2);
}

.title {
    display: block;
    line-height: 1.4285714;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--vp-c-brand-1);
    transition: color 0.25s;
}
</style>
