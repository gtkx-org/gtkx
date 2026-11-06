---
__default__: patch
---

The tab view navigator takes `replaceLastTab`: closing the last tab then replaces it with a new tab of the initial route instead of leaving the close unhandled, for tab views inside a section of the app rather than a window of their own. The overview's `open` now follows the controlled rule of `AdwTabOverview`: when given, a native open or close that `onOpenChange` does not take is restored.
