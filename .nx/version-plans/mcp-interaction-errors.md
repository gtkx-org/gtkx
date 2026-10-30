---
__default__: patch
---

An error the application raises while handling an MCP click, typing or fired signal, such as a component that throws while rendering after the click, is now reported by `gtkx dev` like the same error from keyboard or mouse input: the terminal shows it and the session waits for a fix instead of exiting with only "Application quit". The tool result still carries the error, and when several errors occur at once it lists each message instead of returning an empty one.
