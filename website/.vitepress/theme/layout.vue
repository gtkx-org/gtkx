<script setup lang="ts">
import DefaultTheme from "vitepress/theme";
import ArchitectureStack from "./components/architecture-stack.vue";
import CodeWalkthrough from "./components/code-walkthrough.vue";
import CtaBand from "./components/cta-band.vue";
import HeroDemo from "./components/hero-demo.vue";
import InstallCommand from "./components/install-command.vue";
import Showcase from "./components/showcase.vue";
import SiteFooter from "./components/site-footer.vue";

const { Layout } = DefaultTheme;
</script>

<template>
    <Layout>
        <template #home-hero-info-before>
            <div class="gtkx-hero-eyebrow">GTKX 1.0 · React 19 · GTK4 · Libadwaita · TypeScript</div>
        </template>
        <template #home-hero-actions-after>
            <InstallCommand />
        </template>
        <template #home-hero-image>
            <HeroDemo />
        </template>
        <template #home-hero-after>
            <Showcase />
        </template>
        <template #home-features-before>
            <CodeWalkthrough />
            <div class="gtkx-features-heading">
                <div class="gtkx-eyebrow">What you get</div>
                <h2 class="gtkx-section-title">Everything native. Everything modern.</h2>
            </div>
        </template>
        <template #home-features-after>
            <ArchitectureStack />
            <CtaBand />
        </template>
        <template #layout-bottom>
            <SiteFooter />
        </template>
    </Layout>
</template>
