---
__default__: patch
---

Unmounting a window that holds an `AdwTabOverview`, as quitting the app, a Fast Refresh remount or the cleanup after each test does, no longer prints `Gsk-CRITICAL: gsk_renderer_render_texture` for every open tab. GTKX now destroys the window after removing its content, so the tabs close while the window can still render them.
