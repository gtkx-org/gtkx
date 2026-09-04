<script setup lang="ts">
import { useRoute, useRouter } from "vitepress";
import { computed } from "vue";
import {
    documentationVersionForPath,
    hasVersionCounterpart,
    resolveVersionPath,
    type DocumentationVersion,
} from "../../versioning.js";

const { screenMenu = false } = defineProps<{ screenMenu?: boolean }>();
const route = useRoute();
const router = useRouter();
const selectedVersion = computed<DocumentationVersion>({
    get: () => documentationVersionForPath(route.path),
    set: (targetVersion) => {
        if (targetVersion === documentationVersionForPath(route.path)) {
            return;
        }

        const targetPath = resolveVersionPath(route.path, targetVersion);
        const routeSuffix = hasVersionCounterpart(route.path)
            ? `${window.location.search}${window.location.hash}`
            : "";
        router.go(`${targetPath}${routeSuffix}`);
    },
});
</script>

<template>
  <label class="version-select" :class="{ 'screen-menu': screenMenu }">
    <span>Version</span>
    <select v-model="selectedVersion">
      <option value="stable">1.6 stable</option>
      <option value="beta">2.0 beta 3</option>
    </select>
  </label>
</template>

<style scoped>
.version-select {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 64px;
    padding: 0 12px;
    font-size: 14px;
    font-weight: 500;
    color: var(--vp-c-text-1);
}

.version-select.screen-menu {
    justify-content: space-between;
    min-height: 0;
    padding: 12px 0;
}

select {
    max-width: 136px;
    border: 1px solid var(--vp-c-divider);
    border-radius: 8px;
    padding: 5px 24px 5px 8px;
    color: var(--vp-c-text-1);
    background: var(--vp-c-bg-soft);
    font: inherit;
    cursor: pointer;
}

select:focus-visible {
    outline: 2px solid var(--vp-c-brand-1);
    outline-offset: 2px;
}
</style>
