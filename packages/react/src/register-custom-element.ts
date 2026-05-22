import { CLASS_BY_TYPE_NAME, type NativeClass } from "./generated/internal.js";

/**
 * Registers a JS subclass under a JSX intrinsic-element name so the React
 * reconciler can construct it like any built-in widget.
 *
 * Use this together with {@link registerClass} from `@gtkx/ffi` to expose a
 * custom GObject subclass as a JSX element. The `typeName` you choose becomes
 * both the lookup key the reconciler uses and the string-literal you set as
 * the JSX tag (e.g. `const SimpleConstraintGrid = "SimpleConstraintGrid"`
 * paired with a `JSX.IntrinsicElements` module augmentation).
 *
 * Pass the same name to `registerClass({ gtypeName })` when you want the
 * registered GType to match the JSX tag — that is the common case, since it
 * lets the reconciler reach the construction metadata `registerClass`
 * inherits from the parent class.
 *
 * @example
 * ```tsx
 * import { registerClass } from "@gtkx/ffi";
 * import * as Gtk from "@gtkx/ffi/gtk";
 * import { registerCustomElement } from "@gtkx/react";
 *
 * class MyGrid extends Gtk.Widget {
 *     constructed(): void {
 *         this.setLayoutManager(new Gtk.ConstraintLayout());
 *     }
 * }
 * registerClass(MyGrid, { gtypeName: "MyGrid" });
 * registerCustomElement("MyGrid", MyGrid);
 *
 * const MyGridElement = "MyGrid";
 * declare module "react" {
 *     namespace JSX {
 *         interface IntrinsicElements {
 *             MyGrid: { hexpand?: boolean; vexpand?: boolean };
 *         }
 *     }
 * }
 *
 * <MyGridElement hexpand vexpand />;
 * ```
 *
 * @param typeName - JSX intrinsic-element name. Conventionally matches the
 *   `gtypeName` passed to {@link registerClass}.
 * @param klass - The registered JS subclass to instantiate when the JSX
 *   element is mounted.
 */
export function registerCustomElement(typeName: string, klass: NativeClass): void {
    const map = CLASS_BY_TYPE_NAME as Map<string, NativeClass>;
    map.set(typeName, klass);
}
