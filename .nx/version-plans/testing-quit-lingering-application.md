---
__default__: patch
---

Test cleanup and `unmount()` now quit the application a render started. An application with an `inactivityTimeout`, or one that still held itself when its test ended, used to stay registered after cleanup, so the next test rendering the same application ID failed with "Failed to register" and "render() produced no widgets".
