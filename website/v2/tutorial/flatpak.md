---
description: "Give the Flatpak access to the notes folder and check the app against Flathub's requirements."
---

# Prepare for Flathub

Give the sandboxed app access to the notes folder, then check the Flatpak against Flathub's requirements before submitting it.

::: info Being written
This chapter belongs to the Notes tutorial for GTKX 2.0 and is not written yet. The headings below are its plan; the [finished app](https://github.com/gtkx-org/gtkx/tree/main/tutorial) already contains the code.
:::

## The notes folder in the sandbox

`--filesystem=xdg-documents/Notes:create` gives the Flatpak `Documents/Notes`; a folder elsewhere needs its own permission for live updates.

## Check the build

Run the Flatpak build and Flathub's checks against the generated manifest. See [Deploying](/v2/guide/deploying).

## Submit to Flathub

What the submission needs from the repository.

## Run it

What to check in the running app.
