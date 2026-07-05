import type { ReactNode, ReactPortal } from "react";
import type { Container } from "./types.js";

type GObjectPortal = ReactPortal & {
    $$typeof: symbol;
    containerInfo: Container;
    implementation: null;
};

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
