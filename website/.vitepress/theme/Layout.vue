<script setup lang="ts">
import DefaultTheme from "vitepress/theme-without-fonts";
import { defineAsyncComponent } from "vue";
import VersionBanner from "./components/VersionBanner.vue";

const Landing = defineAsyncComponent(() => import("./landing/Landing.vue"));
const { Layout } = DefaultTheme;
</script>

<template>
    <Layout>
        <template #home-hero-before><Landing /></template>
        <template #doc-before><VersionBanner /></template>
    </Layout>
</template>
