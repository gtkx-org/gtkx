---
__default__: patch
---

`deploy.signing.flatpak` now signs the Flatpak. `gtkx deploy` passed the key only to `flatpak build-bundle`, which ignores it for `.flatpak` bundles, so the repository commit and the bundle were unsigned. The commit is now signed by `flatpak-builder`, and the bundle embeds the key's public part so `flatpak install --bundle` verifies the signature.
