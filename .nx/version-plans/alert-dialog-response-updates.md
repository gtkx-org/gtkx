---
__default__: patch
---

Changing one entry of an `AdwAlertDialog`'s `responses`, such as enabling Create once a name is valid, now updates that response in place. Every response button used to be removed and added again, which moved keyboard focus off the button the user was on and invalidated widget IDs held by tests and MCP clients.
