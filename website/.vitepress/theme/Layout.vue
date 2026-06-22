<script setup lang="ts">
import { useRoute } from "vitepress";
import DefaultTheme from "vitepress/theme";
import { computed } from "vue";
import Landing from "./landing/Landing.vue";

const { Layout } = DefaultTheme;
const route = useRoute();
const isHome = computed(() => route.path === "/" || route.path === "/index.html");
</script>

<template>
  <Landing v-if="isHome" />
  <Layout v-else />
</template>
