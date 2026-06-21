import type * as GObject from "@gtkx/gi/gobject";
import type { ReactNode, ReactPortal } from "react";

type GObjectPortal = ReactPortal & {
    $$typeof: symbol;
    containerInfo: GObject.Object;
    implementation: null;
};

/**
 * Creates a React portal element that renders `children` into the given GObject container.
 *
 * The returned value is a standard React portal node assignable wherever a {@link ReactNode}
 * is accepted, carrying the GObject container so the reconciler can mount the subtree onto it.
 *
 * @param children - The React nodes to render inside the portal.
 * @param container - The GObject instance that hosts the portalled subtree.
 * @param key - An optional React key for the portal element.
 * @returns A React portal element targeting the supplied container.
 */
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
