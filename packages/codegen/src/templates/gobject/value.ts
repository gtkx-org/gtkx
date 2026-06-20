import { getGvalueBoxed, setGvalueBoxed } from "@gtkx/ffi";
import { type GType, Value } from "../gobject.js";

export const buildValue = (gtype: GType, populate: (value: Value) => void): Value => {
    const value = new Value();
    value.init(gtype);
    populate(value);
    return value;
};

Value.prototype.getBoxed = function <T = unknown>(this: Value): T {
    return getGvalueBoxed(this) as T;
};

Value.prototype.setBoxed = function (this: Value, boxed: object | null): void {
    setGvalueBoxed(this, boxed);
};
