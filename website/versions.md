---
title: "Documentation versions"
description: "Which GTKX releases gtkx.dev documents, where each one lives, and how long it stays online."
---

# Documentation versions

Every page under the guide, the tutorial and the API reference belongs to one GTKX release. The version selector in the header switches between them and keeps you on the same page whenever that page exists in the other version.

<VersionsTable />

## How each version is built

The guide and tutorial for a version are written by hand and kept in the repository alongside that version's prefix. The API reference is generated with TypeDoc from the source of the release it documents: a released version builds from its own git tag, pinned by both tag name and commit, and a pre-release builds from the working tree. A reference page therefore always matches the package version it belongs to.

## Machine-readable documentation

Each version publishes its own `llms.txt` index and `llms-full.txt` bundle at its own prefix, covering only that version's pages. Start from [/llms.txt](/llms.txt) for the current release.
