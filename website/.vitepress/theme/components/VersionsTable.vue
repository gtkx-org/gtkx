<script setup lang="ts">
import { documentationLink, GUIDE_ROOT, REFERENCE_ROOT, retentionPolicy, versions } from "../../versioning.js";

const STATUS_TEXT = {
    current: "Current release",
    prerelease: "Pre-release",
    old: "Previous release",
} as const;

const rows = versions.map((version) => ({
    id: version.id,
    label: version.label,
    status: STATUS_TEXT[version.status],
    guide: documentationLink(version, GUIDE_ROOT),
    reference: documentationLink(version, REFERENCE_ROOT),
    examples: `https://github.com/gtkx-org/gtkx/tree/${version.examplesRef}/examples`,
}));
</script>

<template>
  <table class="versions-table">
    <thead>
      <tr>
        <th>Version</th>
        <th>Status</th>
        <th>Documentation</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="row in rows" :key="row.id">
        <td>{{ row.label }}</td>
        <td>{{ row.status }}</td>
        <td>
          <a :href="row.guide">Guide</a>, <a :href="row.reference">API reference</a>,
          <a :href="row.examples">examples</a>
        </td>
      </tr>
    </tbody>
  </table>
  <p>{{ retentionPolicy }}</p>
</template>

<style scoped>
.versions-table {
    display: table;
    width: 100%;
}
</style>
