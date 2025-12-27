import type { ReactNode, ReactPortal } from "react";
import type { Container } from "./types.js";

export const createPortal = (children: ReactNode, container: Container, key?: string | null): ReactPortal => {
    return {
        $$typeof: Symbol.for("react.portal"),
        key: key ?? null,
        children,
        containerInfo: container,
        implementation: null,
    } as unknown as ReactPortal;
};
