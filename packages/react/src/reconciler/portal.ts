import type * as GObject from "@gtkx/gi/gobject";
import type { ReactNode, ReactPortal } from "react";

type PortalElement = {
    // biome-ignore lint/style/useNamingConvention: React element brand, name fixed by React
    $$typeof: symbol;
    key: string | null;
    children: ReactNode;
    containerInfo: GObject.Object;
    implementation: null;
};

export const createPortal = (children: ReactNode, container: GObject.Object, key?: string | null): ReactPortal => {
    const portal: PortalElement = {
        // biome-ignore lint/style/useNamingConvention: React element brand, name fixed by React
        $$typeof: Symbol.for("react.portal"),
        key: key ?? null,
        children,
        containerInfo: container,
        implementation: null,
    };
    const element: unknown = portal;
    return element as ReactPortal;
};
