---
__default__: minor
---

`withSignals` from `@gtkx/runtime` lets a class emit, connect and listen to its own declared signals on `this`, and signal methods on `this` typecheck against inherited signals. Registered classes accept their declared properties in `new`, are assignable to the interfaces they implement, and give `paramSpecBoxed` properties keys in `useProperty` and `GObject.getProperty`. Their own properties emit `notify` whenever their stored value changes, as in GJS.
