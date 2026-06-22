import type * as GObject from "@gtkx/gi/gobject";
import type { ReactNode, ReactPortal } from "react";

type GObjectPortal = ReactPortal & {
    $$typeof: symbol;
    containerInfo: GObject.Object;
    implementation: null;
};

export const createPortal = (children: ReactNode, container: GObject.Object, key?: string | null): ReactPortal => {
    const portal: GObjectPortal = {
        $$typeof: Symbol.for("react.portal"),
        type: "",
        props: { children },
        key: key ?? null,
        children,
        containerInfo: container,
        implementation: null,
    };
    return portal;
};
