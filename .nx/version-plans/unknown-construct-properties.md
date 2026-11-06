---
__default__: patch
---

Constructing an object with a key that names none of its type's properties now throws a `TypeError` naming the key and the type, as GJS does: `new Gio.Notification({ title: "Done" })` fails with "No property title on GNotification". Such keys used to be skipped, so the object was built without the value and the mistake surfaced later, for example as a notification sent without a title. Use the type's constructor function for values that are not properties, such as `Gio.Notification.new("Done")`.
