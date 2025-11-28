import type { ReactNode, ReactPortal } from "react";

const ROOT_PORTAL_CONTAINER = Symbol("ROOT_PORTAL_CONTAINER");

/**
 * Checks if a container is the root portal container (for dialogs, etc.).
 */
export const isRootPortalContainer = (container: unknown): boolean => container === ROOT_PORTAL_CONTAINER;

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
 * {createPortal(<Label label="This is in the Box" />, boxRef.current)}
 * ```
 */
export const createPortal = (children: ReactNode, container?: unknown, key?: string | null): ReactPortal => {
    return {
        $$typeof: Symbol.for("react.portal"),
        key: key ?? null,
        children,
        containerInfo: container ?? ROOT_PORTAL_CONTAINER,
        implementation: null,
    } as unknown as ReactPortal;
};
