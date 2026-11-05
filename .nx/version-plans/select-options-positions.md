---
__default__: patch
---

`userEvent.selectOptions` and `deselectOptions` reject a position past the last item, or a value that is not a position such as an option label, with an error naming the valid positions. Before, an out-of-range position left the selection unchanged without an error, and a label failed inside the GTK binding with "Expected a Number for uint32".
