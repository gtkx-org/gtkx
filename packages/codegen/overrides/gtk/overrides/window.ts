import { getHandle } from "@gtkx/runtime";
import { initializeWrapper, propertyWriteComplete, resolveFunction, setWrapperBorrow } from "@gtkx/runtime/internal";
import { Window } from "../gtk.js";

const methods: {
    setDefaultWidget: Window["setDefaultWidget"];
    setProperty: Window["setProperty"];
} = Window.prototype;
const { setDefaultWidget, setProperty } = methods;

const clearNativeDefault = resolveFunction("libgtk-4.so.1", "gtk_window_set_default_widget");

function retainCurrentDefault(window: Window): void {
    const widget = window.getDefaultWidget();
    const handle = getHandle(window);

    if (widget === null) {
        setWrapperBorrow(handle, null, null);
    } else {
        setWrapperBorrow(handle, getHandle(widget), clearNativeDefault);
    }
}

function completeDefaultWidgetProperty(this: Window, propertyName: string): void {
    if (propertyName === "default-widget") {
        retainCurrentDefault(this);
    }
}

/* TODO: Keep the default widget alive until supported GTK clears its borrowed pointer before removal.
 * https://github.com/gtkx-org/gtkx/issues/728
 */
Window.prototype.setDefaultWidget = function (widget): void {
    setDefaultWidget.call(this, widget);
    retainCurrentDefault(this);
};
Window.prototype.setProperty = function (propertyName, value): void {
    setProperty.call(this, propertyName, value);
    completeDefaultWidgetProperty.call(this, propertyName);
};
Object.defineProperties(Window.prototype, {
    [propertyWriteComplete]: { value: completeDefaultWidgetProperty },
    [initializeWrapper]: {
        value: function (this: Window): void {
            retainCurrentDefault(this);
            const receiver = new WeakRef(this);
            this.on("notify::default-widget", () => {
                const window = receiver.deref();

                if (window !== undefined) {
                    retainCurrentDefault(window);
                }
            });
        },
    },
});
