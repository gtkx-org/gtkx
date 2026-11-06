---
__default__: patch
---

Construct-only object props now accept JSX elements, such as `userContentManager={<WebKitUserContentManager onScriptMessageReceived={...} />}` on a `WebKitWebView`. GTKX builds the prop's element before its parent and passes its object at construction. These props used to take only an existing instance, so `tsc` rejected the element. Replacing or removing the element while the parent is mounted throws the construct-only prop error, which asks for a new key.
