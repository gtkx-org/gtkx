<script setup lang="ts">
import { computed } from "vue";
import { currentVersion } from "../../versioning.js";
import { useDocumentationVersion } from "../composables/use-documentation-version";

const { version, link, isSamePage } = useDocumentationVersion();

const notice = computed(() => {
    const active = version.value;

    if (active.status === "current" || active.id === currentVersion.id) {
        return undefined;
    }

    const lead =
        active.status === "prerelease"
            ? `Prerelease docs, tracking main after GTKX ${active.label}.`
            : `GTKX ${active.label} is no longer the current release.`;

    return {
        lead,
        href: link(currentVersion),
        text: isSamePage(currentVersion)
            ? `Read this page for ${currentVersion.label}`
            : `Read the ${currentVersion.label} docs`,
    };
});
</script>

<template>
    <aside v-if="notice" class="version-banner" role="note">
        <span class="dot" aria-hidden="true"></span>
        <p>
            {{ notice.lead }}
            <a :href="notice.href">{{ notice.text }}</a>
            · <a href="/versions">All versions</a>
        </p>
    </aside>
</template>

<style scoped>
.version-banner {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin: 0 0 24px;
    border-radius: 8px;
    padding: 6px 12px;
    background: var(--vp-c-bg-alt);
}

.dot {
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--yellow-500);
    transform: translateY(-1px);
}

.version-banner p {
    margin: 0;
    font-size: 13px;
    line-height: 1.5;
    color: var(--vp-c-text-2);
}

.version-banner a {
    font-weight: 600;
    color: var(--vp-c-brand-1);
    text-decoration: underline;
    text-underline-offset: 2px;
}
</style>
