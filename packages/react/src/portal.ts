import type { ReactNode, ReactPortal } from "react";
import { ROOT_NODE_CONTAINER } from "./factory.js";

/**
 * Creates a portal that renders children into a different GTK widget container.
 *
 * Similar to ReactDOM.createPortal, this allows you to render a subtree into
 * a different part of the widget tree.
 *
 * When called without a container argument, the portal renders at the root level.
 * This is useful for dialogs which don't need a parent container.
 *
 * @example
 * ```tsx
 * // Render dialog at root level (no container needed)
 * {createPortal(<AboutDialog programName="My App" />)}
 *
 * // Render into a specific container
 * {createPortal(<Label.Root label="This is in the Box" />, boxRef.current)}
 * ```
 */
export const createPortal = (children: ReactNode, container?: unknown, key?: string | null): ReactPortal => {
    // ReactPortal is an opaque type but we need to construct it manually for custom reconcilers.
    // The shape matches React's internal portal representation.
    return {
        $$typeof: Symbol.for("react.portal"),
        key: key ?? null,
        children,
        containerInfo: container ?? ROOT_NODE_CONTAINER,
        implementation: null,
    } as unknown as ReactPortal;
};
