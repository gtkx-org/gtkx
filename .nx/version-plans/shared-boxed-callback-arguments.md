---
__default__: patch
---

A reference-counted boxed value that a signal or callback receives, such as WebKit's `WebKit.ScriptMessageReply`, now stays usable after the handler returns, as it does in C and GJS. An app can answer `onScriptMessageWithReplyReceived` asynchronously by returning `true` and calling `reply.returnValue` once its work finishes. Calling the reply later used to throw, because GTKX revoked every boxed value lent to a handler when the handler returned.
