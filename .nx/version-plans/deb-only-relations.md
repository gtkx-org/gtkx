---
__default__: patch
---

`deploy.relations.breaks` and `deploy.relations.preDepends` now accept only `deb` entries. RPM has neither relation, and `rpm` entries were previously accepted and then left out of the package without a warning. The `deploy.scripts` hints now say that each script is a path relative to the project root.
