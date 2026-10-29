---
__default__: patch
---

Translation extraction now rejects `i18n.t(...)` on the `i18n` instance returned by `useTranslation`, as the Internationalization guide describes. Such calls were silently left out of the catalog, so their keys failed to typecheck without naming the cause.
