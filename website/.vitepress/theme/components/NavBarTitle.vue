<script setup lang="ts">
import VPNavBarTitle from "vitepress/dist/client/theme-default/components/VPNavBarTitle.vue";
import VersionChip from "./VersionChip.vue";
</script>

<template>
    <div class="nav-bar-title">
        <VPNavBarTitle>
            <template #nav-bar-title-before><slot name="nav-bar-title-before" /></template>
            <template #nav-bar-title-after><slot name="nav-bar-title-after" /></template>
        </VPNavBarTitle>
        <VersionChip />
    </div>
</template>

<style scoped>
.nav-bar-title {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
    height: 100%;
}

.nav-bar-title > :deep(.VPNavBarTitle) {
    min-width: 0;
}
</style>
