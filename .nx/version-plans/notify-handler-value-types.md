---
__default__: patch
---

`onNotify<Prop>` handlers now receive the property's value with the same type as its getter, so a boolean, number or enum property no longer arrives as `| null`. `onNotifyActive={setFavorite}` with a `useState<boolean>` setter now typechecks without `?? false`.
