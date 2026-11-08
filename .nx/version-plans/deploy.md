---
__default__: patch
---

RPM packages require the shared libraries of the configured GIR libraries and no longer own system directories, and a deb deployment with an empty `deploy.depends.deb` names the libraries to cover. Packages leave GSettings schemas to the system so vendor overrides apply, `deploy.extraFiles` accepts directories, and `deploy.relations.breaks` and `preDepends` accept only `deb` entries. `--skip-build` accepts deploy-only configuration changes but stops on a build of another entry, and AppStream validation no longer fails on untranslated strings.
