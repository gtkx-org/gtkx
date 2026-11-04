---
__default__: patch
---

Translation extraction leaves out the files that Storybook's `stories` patterns match, so text that stories pass through `t()` for their own fixtures no longer reaches `po/POTFILES.in`, the template or the catalogs. Stories still render the translations of the components they show.
