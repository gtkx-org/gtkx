<script setup lang="ts">
import DefaultTheme from "vitepress/theme-without-fonts";
import { computed, defineAsyncComponent } from "vue";
import TutorialPager from "./components/TutorialPager.vue";
import TutorialProgress from "./components/TutorialProgress.vue";
import VersionBanner from "./components/VersionBanner.vue";
import { useTutorialPosition } from "./composables/use-tutorial-position";

const Landing = defineAsyncComponent(() => import("./landing/Landing.vue"));
const { Layout } = DefaultTheme;
const tutorial = useTutorialPosition();

const tutorialStyle = computed(() => {
    const current = tutorial.value;

    if (current?.chapter === undefined) {
        return undefined;
    }

    return {
        "--tutorial-position": JSON.stringify(`Chapter ${current.chapter} of ${current.total}`),
        "--tutorial-position-short": JSON.stringify(`${current.chapter}/${current.total}`),
    };
});
</script>

<template>
    <Layout :class="{ 'numbered-tutorial': tutorial }" :style="tutorialStyle">
        <template #home-hero-before><Landing /></template>
        <template #doc-before><VersionBanner /><TutorialProgress /></template>
        <template #doc-after><TutorialPager /></template>
    </Layout>
</template>
