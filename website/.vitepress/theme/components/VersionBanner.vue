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
            ? `This is pre-release documentation for GTKX ${active.label}.`
            : `This is documentation for GTKX ${active.label}, which is no longer the current release.`;

    return {
        lead,
        href: link(currentVersion),
        text: isSamePage(currentVersion)
            ? `Read this page for GTKX ${currentVersion.label}`
            : `Read the GTKX ${currentVersion.label} documentation`,
    };
});
</script>

<template>
  <aside v-if="notice" class="version-banner" role="note">
    <p>
      {{ notice.lead }}
      <a :href="notice.href">{{ notice.text }}</a
      >, or see <a href="/versions">all documentation versions</a>.
    </p>
  </aside>
</template>

<style scoped>
.version-banner {
    margin: 0 0 24px;
    border: 1px solid var(--vp-c-warning-1, var(--vp-c-divider));
    border-radius: 8px;
    padding: 12px 16px;
    background: var(--vp-c-warning-soft, var(--vp-c-bg-soft));
}

.version-banner p {
    margin: 0;
    font-size: 14px;
    line-height: 1.6;
    color: var(--vp-c-text-1);
}

.version-banner a {
    font-weight: 600;
    color: var(--vp-c-brand-1);
    text-decoration: underline;
    text-underline-offset: 2px;
}
</style>
