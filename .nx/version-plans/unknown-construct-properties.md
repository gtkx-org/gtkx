---
__default__: major
---

Constructing an object with a key that names none of its type's properties now throws a `TypeError`, as GJS does: `new Gio.Notification({ title: "Done" })` fails with "No property title on GNotification" instead of building the object without the value. Use the type's constructor function for values that are not properties, such as `Gio.Notification.new("Done")`. See the [upgrade guide](https://gtkx.dev/v2/guide/upgrading-to-2#check-the-behavior-changes).
