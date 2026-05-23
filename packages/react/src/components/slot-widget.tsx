import { createElement, type ReactNode } from "react";

type SlotPropValue = ReactNode | null | undefined;

/**
 * Creates a function component for a widget that has named property slots.
 *
 * The returned component extracts slot props (ReactNode values), forwards
 * remaining props to the underlying intrinsic element, and appends internal
 * Slot children for each non-null slot prop.
 *
 * @param intrinsicName - The intrinsic element name (e.g., "GtkWindow")
 * @param slotNames - Array of camelCase slot prop names (e.g., ["titlebar", "startChild"])
 * @public
 */
export function createSlotWidget<P = unknown>(
    intrinsicName: string,
    slotNames: readonly string[],
): (props: P & { children?: ReactNode }) => ReactNode {
    const slotSet = new Set(slotNames);

    return (props: P & { children?: ReactNode }): ReactNode => {
        const forwardedProps: Record<string, unknown> = {};
        const slotChildren: ReactNode[] = [];
        const propsRecord = props as Record<string, unknown>;

        for (const key in propsRecord) {
            if (slotSet.has(key)) {
                const value = propsRecord[key] as SlotPropValue;
                if (value != null) {
                    slotChildren.push(createElement("Slot", { key: `__slot_${key}`, id: key }, value));
                }
            } else {
                forwardedProps[key] = propsRecord[key];
            }
        }

        const { children } = props;

        if (slotChildren.length > 0) {
            return createElement(intrinsicName, forwardedProps, children, ...slotChildren);
        }

        return createElement(intrinsicName, forwardedProps, children);
    };
}
