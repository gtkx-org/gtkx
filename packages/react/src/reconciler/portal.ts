import type { ReactNode, ReactPortal } from "react";
import type { Container } from "./types.js";

type GObjectPortal = ReactPortal & {
    $$typeof: symbol;
    containerInfo: Container;
    implementation: null;
};

/**
 * Creates a React portal that renders `children` into a different container in the widget tree.
 *
 * @param children The nodes to render inside the container.
 * @param container The GObject or root element to render into.
 * @param key An optional React key for the portal.
 */
export const createPortal = (children: ReactNode, container: Container, key?: string | null): ReactPortal => {
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
