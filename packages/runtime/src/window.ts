import {
    type ExternalObject,
    type Handle,
    bind as nativeBind,
    call as nativeCall,
    setWrapperBorrow,
} from "@gtkx/native";
import { objectT, voidT } from "./descriptors.js";
import { propertyWriteComplete } from "./property-brand.js";
import { getHandle } from "./registry.js";
import { toAbi } from "./scalar-plan.js";
import { connectClosureSignal } from "./signal.js";
import { initializeWrapper } from "./wrapper-brand.js";

type Window = {
    getDefaultWidget: () => object | null;
    setDefaultWidget: (widget: object | null) => void;
    setProperty: (propertyName: string, value: object) => void;
};

const retainedDefaults: WeakMap<Window, object> = new WeakMap();
const objectAbi = toAbi(objectT("borrowed"));
const defaultWidgetSetter = nativeBind(
    "libgtk-4.so.1",
    "gtk_window_set_default_widget",
    [objectAbi, objectAbi],
    toAbi(voidT),
);

const clearNativeDefault = (handle: ExternalObject<Handle>): (() => void) =>
    () => {
        nativeCall(defaultWidgetSetter, [handle, null]);
    };

const retainNativeDefault = (window: Window, widget: object): void => {
    const handle = getHandle(window);
    setWrapperBorrow(handle, getHandle(widget), clearNativeDefault(handle));
};

function retainCurrentDefault(window: Window): void {
    const widget = window.getDefaultWidget();

    if (widget === null) {
        retainedDefaults.delete(window);
        setWrapperBorrow(getHandle(window), null, null);
    } else {
        if (retainedDefaults.get(window) !== widget) {
            retainedDefaults.set(window, widget);
        }
        retainNativeDefault(window, widget);
    }
}

function completeDefaultWidgetProperty(this: Window, propertyName: string): void {
    if (propertyName === "default-widget") {
        retainCurrentDefault(this);
    }
}

function installWindowDefaultWidgetOverride(prototype: Window): void {
    const { setDefaultWidget, setProperty } = prototype;

    prototype.setDefaultWidget = function (this: Window, widget): void {
        setDefaultWidget.call(this, widget);
        retainCurrentDefault(this);
    };
    prototype.setProperty = function (this: Window, propertyName, value): void {
        setProperty.call(this, propertyName, value);
        completeDefaultWidgetProperty.call(this, propertyName);
    };
    Object.defineProperties(prototype, {
        [propertyWriteComplete]: { value: completeDefaultWidgetProperty },
        [initializeWrapper]: {
            value: function (this: Window): void {
                retainCurrentDefault(this);
                const receiver = new WeakRef(this);
                connectClosureSignal(this, "notify::default-widget", () => {
                    const window = receiver.deref();

                    if (window !== undefined) {
                        retainCurrentDefault(window);
                    }
                }, false);
            },
        },
    });
}

export { installWindowDefaultWidgetOverride };
