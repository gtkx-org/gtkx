import type * as Gtk from "@gtkx/ffi/gtk";
import type Reconciler from "react-reconciler";
import { reconciler } from "./reconciler.js";

export const createFiberRoot = (container: Gtk.Widget): Reconciler.FiberRoot => {
    const instance = reconciler.getInstance();

    return instance.createContainer(
        container,
        1,
        null,
        false,
        null,
        "",
        (error: Error) => console.error("Fiber root render error:", error),
        () => {},
        () => {},
        () => {},
    );
};
