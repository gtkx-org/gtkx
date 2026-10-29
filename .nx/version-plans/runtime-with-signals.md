---
__default__: minor
---

Add `withSignals` to `@gtkx/runtime`. A class that extends `withSignals(Base, signals)` can emit, connect and listen to its own declared signals on `this` inside its body, which used to need a cast to the registered class. `registerClass` installs those signals together with its `signals` option and rejects a name declared in both.
