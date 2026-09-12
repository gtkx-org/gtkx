<script setup lang="ts">
import { useRouter } from "vitepress";
import { computed } from "vue";
import { versionById, versions } from "../../versioning.js";
import { useDocumentationVersion } from "../composables/use-documentation-version";

const { screenMenu = false } = defineProps<{ screenMenu?: boolean }>();
const router = useRouter();
const { version, link, isSamePage } = useDocumentationVersion();

const selectedVersion = computed<string>({
    get: () => version.value.id,
    set: (id) => {
        if (id === version.value.id) {
            return;
        }

        const target = versionById(id);
        const routeSuffix = isSamePage(target) ? `${window.location.search}${window.location.hash}` : "";
        router.go(`${link(target)}${routeSuffix}`);
    },
});
</script>

<template>
  <label class="version-select" :class="{ 'screen-menu': screenMenu }">
    <span>Version</span>
    <select v-model="selectedVersion">
      <option v-for="entry in versions" :key="entry.id" :value="entry.id">{{ entry.label }}</option>
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
