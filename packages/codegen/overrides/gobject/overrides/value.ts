import { getBoxedValue, getHandle, type JsValue, setBoxedValue } from "@gtkx/runtime";
import { Value } from "../gobject.js";

Value.prototype.getBoxed = function <T = unknown>(this: Value): T {
    return getBoxedValue(getHandle(this)) as T;
};

Value.prototype.setBoxed = function (this: Value, boxed: JsValue | object): void {
    setBoxedValue(getHandle(this), boxed);
};
