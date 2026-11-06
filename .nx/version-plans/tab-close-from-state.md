---
__default__: patch
---

A JSX `AdwTabPage` that `onClosePage` removes from state now closes even when the handler returns `true` without calling `closePageFinish`. The tab used to stay in the bar as an empty page that no later render or close button could remove.
