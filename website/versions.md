---
title: "Documentation versions"
description: "Which GTKX releases gtkx.dev documents, where each one lives, and how long it stays online."
---

# Documentation versions

Every page under the guide, the tutorial and the API reference belongs to one GTKX release. The version selector in the header switches between them and keeps you on the same page whenever that page exists in the other version.

<VersionsTable />

## How each version is built

Each version has its own guides, tutorial, and package API reference. Archived references use their release's source; documentation for the active development version follows the working tree. Contributor pages always follow `main`.

See [Maintaining Documentation](/contributing/documentation#documentation-versions) for source pinning and release promotion.

## Machine-readable documentation

Each version publishes its own `llms.txt` index and `llms-full.txt` bundle at its own prefix. The index links to that version's guide, tutorial, and API reference; the full bundle contains its guide and tutorial text.

Both exports also include the shared [Contributing](/contributing/) documentation, which follows development on `main` independently of release versions. Start from [/llms.txt](/llms.txt) for the current release.
