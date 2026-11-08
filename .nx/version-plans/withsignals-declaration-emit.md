---
__default__: patch
---

Libraries that emit declarations can now export a class that extends `withSignals`, or the class `registerClass` makes from it, instead of failing with TS4094 and TS4020 because the base class's type could not be written to a declaration file. The base class `withSignals` returns is now typed as `SignalBaseClass`, which keeps typed `emit`, `connect`, `on`, `once` and `off` inside the class body but no longer carries the base class's static members.
