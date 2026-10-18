---
__default__: patch
---

Marshal regex matches through a dedicated MatchInfo descriptor while retaining subject ownership through native callbacks and GValue copies. Remove the dedicated native MatchInfo exports and runtime method forwarding.
