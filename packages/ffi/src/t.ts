import * as helpers from "./descriptors.js";
import { fn } from "./fn.js";

type T = {
    bind: typeof helpers.bind;
    int8: typeof helpers.int8T;
    uint8: typeof helpers.uint8T;
    int16: typeof helpers.int16T;
    uint16: typeof helpers.uint16T;
    int32: typeof helpers.int32T;
    uint32: typeof helpers.uint32T;
    int64: typeof helpers.int64T;
    uint64: typeof helpers.uint64T;
    bigint64: typeof helpers.bigint64T;
    biguint64: typeof helpers.biguint64T;
    float32: typeof helpers.float32T;
    float64: typeof helpers.float64T;
    boolean: typeof helpers.booleanT;
    void: typeof helpers.voidT;
    unichar: typeof helpers.unicharT;
    blob: typeof helpers.blobT;
    string: typeof helpers.stringT;
    object: typeof helpers.objectT;
    boxed: typeof helpers.boxedT;
    struct: typeof helpers.structT;
    fundamental: typeof helpers.fundamentalT;
    ref: typeof helpers.refT;
    hashTable: typeof helpers.hashTableT;
    enum: typeof helpers.enumT;
    flags: typeof helpers.flagsT;
    array: typeof helpers.arrayT;
    list: typeof helpers.listT;
    slist: typeof helpers.slistT;
    ptrArray: typeof helpers.ptrArrayT;
    garray: typeof helpers.garrayT;
    byteArray: typeof helpers.byteArrayT;
    sizedArray: typeof helpers.sizedArrayT;
    fixedArray: typeof helpers.fixedArrayT;
    callback: typeof helpers.callbackT;
    fn: typeof fn;
};

export const t: T = {
    bind: helpers.bind,
    int8: helpers.int8T,
    uint8: helpers.uint8T,
    int16: helpers.int16T,
    uint16: helpers.uint16T,
    int32: helpers.int32T,
    uint32: helpers.uint32T,
    int64: helpers.int64T,
    uint64: helpers.uint64T,
    bigint64: helpers.bigint64T,
    biguint64: helpers.biguint64T,
    float32: helpers.float32T,
    float64: helpers.float64T,
    boolean: helpers.booleanT,
    void: helpers.voidT,
    unichar: helpers.unicharT,
    blob: helpers.blobT,
    string: helpers.stringT,
    object: helpers.objectT,
    boxed: helpers.boxedT,
    struct: helpers.structT,
    fundamental: helpers.fundamentalT,
    ref: helpers.refT,
    hashTable: helpers.hashTableT,
    enum: helpers.enumT,
    flags: helpers.flagsT,
    array: helpers.arrayT,
    list: helpers.listT,
    slist: helpers.slistT,
    ptrArray: helpers.ptrArrayT,
    garray: helpers.garrayT,
    byteArray: helpers.byteArrayT,
    sizedArray: helpers.sizedArrayT,
    fixedArray: helpers.fixedArrayT,
    callback: helpers.callbackT,
    fn,
};
