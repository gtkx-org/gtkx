---
__default__: patch
---

A `gtkx.config.ts` without an `applicationId` now fails with "is required" at `applicationId` instead of "must satisfy g_application_id_is_valid", which read like an invalid value. The Monorepos section also says that a shared package running its own Vitest tests needs a `gtkx.config.ts` with an `applicationId`.
