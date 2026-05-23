import { createElement, type ReactNode } from "react";

type ContainerSlotChild = (props: { children?: ReactNode }) => ReactNode;

/**
 * Creates a compound child component that delegates to a ContainerSlot
 * with a specific method name.
 *
 * @param methodName - The container slot method name (e.g., "packStart", "addPrefix")
 * @public
 */
export function createContainerSlotChild(methodName: string): ContainerSlotChild {
    return (props: { children?: ReactNode }): ReactNode => {
        return createElement("ContainerSlot", { id: methodName }, props.children);
    };
}

/**
 * Creates a compound child component that delegates to an existing
 * virtual node intrinsic element.
 *
 * @param intrinsicName - The intrinsic element name (e.g., "StackPage", "GridChild")
 * @public
 */
export function createVirtualChild<P extends Record<string, unknown>>(
    intrinsicName: string,
): (props: P & { children?: ReactNode }) => ReactNode {
    return (props: P & { children?: ReactNode }): ReactNode => {
        return createElement(intrinsicName, props, props.children);
    };
}

/**
 * Creates a compound child component for NavigationPage that automatically
 * sets the `for` discriminant based on the parent widget type.
 *
 * @param forValue - The `for` discriminant value (e.g., "AdwNavigationView")
 * @public
 */
export function createNavigationPageChild<P extends Record<string, unknown>>(
    forValue: string,
): (props: P & { children?: ReactNode }) => ReactNode {
    return (props: P & { children?: ReactNode }): ReactNode => {
        return createElement("NavigationPage", { ...props, for: forValue }, props.children);
    };
}
