---
__default__: patch
---

Fixed-size array fields of `gsize`, `gssize` and other 64-bit integers that GTKX marshals as numbers, such as `GstVideo.VideoInfo.offset` and `GstRtp.RTPBuffer.size`, now only accept a number array: their setters always rejected the `BigInt64Array` or `BigUint64Array` the declarations allowed, because those views hold bigints.
