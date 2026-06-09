<script setup lang="ts">
import DefaultTheme from "vitepress/theme";
import ArchitectureStack from "./components/architecture-stack.vue";
import HeroDemo from "./components/hero-demo.vue";
import SiteFooter from "./components/site-footer.vue";

const { Layout } = DefaultTheme;
</script>

<template>
    <Layout>
        <template #home-hero-info-before>
            <div class="gtkx-hero-eyebrow">Linux · React 19 · GTK4 · TypeScript</div>
        </template>
        <template #home-hero-image>
            <HeroDemo />
        </template>
        <template #home-features-after>
            <ArchitectureStack />
        </template>
        <template #layout-bottom>
            <SiteFooter />
        </template>
    </Layout>
</template>
