---
__default__: patch
---

A source-mode Flatpak whose `deploy.flatpak.source.url` is a local `file://` path no longer fails with an error that calls it an SSH remote; the error now says that Flathub can only fetch an https:// URL.
