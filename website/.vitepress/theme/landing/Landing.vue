<script setup lang="ts">
import Closing from "./Closing.vue";
import Footer from "./Footer.vue";
import Hero from "./Hero.vue";
import Packages from "./Packages.vue";
import Tutorial from "./Tutorial.vue";
import Why from "./Why.vue";
import Workflow from "./Workflow.vue";
</script>

<template>
    <div class="landing">
        <main>
            <Hero />
            <Workflow />
            <Packages />
            <Why />
            <Tutorial />
            <Closing />
        </main>
        <Footer />
    </div>
</template>
