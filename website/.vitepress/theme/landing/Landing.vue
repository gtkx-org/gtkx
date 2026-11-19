<script setup lang="ts">
import Closing from "./Closing.vue";
import Footer from "./Footer.vue";
import Hero from "./Hero.vue";
import Showcase from "./Showcase.vue";
import Why from "./Why.vue";
import Workflow from "./Workflow.vue";
</script>

<template>
    <div class="landing">
        <main>
            <Hero />
            <Workflow />
            <Why />
            <Showcase />
            <Closing />
        </main>
        <Footer />
    </div>
</template>
