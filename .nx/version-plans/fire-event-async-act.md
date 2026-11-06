---
__default__: patch
---

`fireEvent` and the gesture helpers of `@gtkx/testing` keep React's act scope open across the microtasks that follow a signal handler, as `userEvent` already did. Handlers whose state updates arrive a microtask later, such as React Hook Form validation after `field.onChange` in a `GtkCalendar` `onDaySelected`, no longer print "not wrapped in act(...)" warnings.
