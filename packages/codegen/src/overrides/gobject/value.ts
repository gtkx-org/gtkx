import { getGValueBoxed, setGValueBoxed } from "@gtkx/ffi";
import { type GType, Value } from "../gobject.js";

export const buildValue = (gtype: GType, populate: (value: Value) => void): Value => {
    const value = new Value();
    value.init(gtype);
    populate(value);
    return value;
};

Value.prototype.getBoxed = function <T = unknown>(this: Value): T {
    return getGValueBoxed(this) as T;
};

Value.prototype.setBoxed = function (this: Value, boxed: object | null): void {
    setGValueBoxed(this, boxed);
};
