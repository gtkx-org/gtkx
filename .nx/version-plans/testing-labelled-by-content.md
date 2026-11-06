---
__default__: patch
---

`@gtkx/testing` names a widget from the labels inside the widget that labels it when that widget has no name of its own, as GTK does. `getByRole(Gtk.AccessibleRole.SPIN_BUTTON, { name: "Amount" })` now finds the spin button of an `AdwSpinRow` titled "Amount", including a `SpinRow` from `@gtkx/forms`. Previously its name was empty.
