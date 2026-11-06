---
__default__: patch
---

Cairo image surfaces now count their pixel memory toward garbage collection, so code that creates offscreen surfaces every frame no longer grows to gigabytes before JavaScript releases the old ones. This covers surfaces from `new ImageSurface(...)`, `ImageSurface.create`, `ImageSurface.createFromPng`, `Surface.createSimilarImage` and `Surface.createSimilar`.
