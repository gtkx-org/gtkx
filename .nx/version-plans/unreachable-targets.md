---
__default__: minor
---

`@gtkx/testing` and the MCP tools refuse input a user could not give: pointer helpers reject a widget behind an open `AdwDialog` or inside one whose `canTarget` is off, keyboard helpers reject a widget behind such a dialog, and the error names what blocks the target. Window shortcuts and application accelerators no longer run for keys pressed inside an open dialog or popover.
