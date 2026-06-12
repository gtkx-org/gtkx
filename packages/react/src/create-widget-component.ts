/// <reference types="@gtkx/config/virtual" />

/**
 * The generic component factory behind every generated `@gtkx/jsx` element.
 *
 * A generated namespace module emits one line per element —
 * `export const GtkButton = createWidgetComponent("GtkButton")` — instead of
 * a per-widget component body. The factory resolves the element's slot
 * surface at first render by walking its registered class's GType ancestry
 * against the merged `SLOTS`/`CONTAINER_SLOTS` tables from
 * `virtual:gtkx-config`, then renders element-valued props as the metadata
 * wrapper children the reconciler's element map interprets: slot props become
 * `kind="slot"` wrappers (setter semantics), container-slot props become
 * `kind="container-slot"` wrappers (append semantics through the named
 * method).
 */
import { CONTAINER_SLOTS, SLOTS } from "virtual:gtkx-config";
import { getNativeClassByName } from "@gtkx/ffi";
import { createElement, type ReactNode } from "react";
import { classHasType, type GTyped } from "./gtype-predicates.js";
import { WRAPPER_NODE_ELEMENT } from "./instance.js";

type SlotSurface = {
    readonly slotSet: ReadonlySet<string>;
    readonly containerSet: ReadonlySet<string>;
    readonly names: readonly string[];
};

const EMPTY_SURFACE: SlotSurface = { slotSet: new Set(), containerSet: new Set(), names: [] };

const surfaceCache = new Map<string, SlotSurface>();

const collectInherited = (
    table: Readonly<Record<string, readonly string[]>>,
    cls: { readonly prototype: GTyped },
): readonly string[] => {
    const collected: string[] = [];
    for (const [typeName, names] of Object.entries(table)) {
        if (!classHasType(cls, typeName)) continue;
        for (const name of names) {
            if (!collected.includes(name)) collected.push(name);
        }
    }
    return collected;
};

const buildSlotSurface = (cls: { readonly prototype: GTyped }): SlotSurface => {
    const slots = collectInherited(SLOTS, cls);
    const containerSlots = collectInherited(CONTAINER_SLOTS, cls);
    return { slotSet: new Set(slots), containerSet: new Set(containerSlots), names: [...slots, ...containerSlots] };
};

const resolveSlotSurface = (elementName: string): SlotSurface => {
    const cached = surfaceCache.get(elementName);
    if (cached) return cached;
    const cls = getNativeClassByName(elementName) as { readonly prototype: GTyped } | null;
    const surface = cls ? buildSlotSurface(cls) : EMPTY_SURFACE;
    surfaceCache.set(elementName, surface);
    return surface;
};

const hasAnySlotProp = (props: object, surface: SlotSurface): boolean => {
    for (const name of surface.names) {
        if (name in props) return true;
    }
    return false;
};

type SplitProps = {
    readonly rest: Record<string, unknown>;
    readonly wrappers: ReactNode[];
    readonly children: ReactNode;
};

const splitProps = (props: object, surface: SlotSurface): SplitProps => {
    const rest: Record<string, unknown> = {};
    const wrappers: ReactNode[] = [];
    let children: ReactNode = null;
    const { slotSet, containerSet } = surface;
    for (const [name, value] of Object.entries(props)) {
        if (name === "children") {
            children = value as ReactNode;
            continue;
        }
        if (slotSet.has(name)) {
            if (value != null) {
                wrappers.push(
                    createElement(
                        WRAPPER_NODE_ELEMENT,
                        { kind: "slot", propName: name, key: `slot:${name}` },
                        value as ReactNode,
                    ),
                );
            }
            continue;
        }
        if (containerSet.has(name)) {
            if (value != null) {
                wrappers.push(
                    createElement(
                        WRAPPER_NODE_ELEMENT,
                        { kind: "container-slot", method: name, key: `container-slot:${name}` },
                        value as ReactNode,
                    ),
                );
            }
            continue;
        }
        rest[name] = value;
    }
    return { rest, wrappers, children };
};

/**
 * Builds the component for one generated JSX element.
 *
 * The component splits the element's slot and container-slot props (resolved
 * from the merged tables against the element's GType ancestry) into metadata
 * wrapper children rendered after the regular children, and forwards every
 * other prop to the intrinsic element. When none of the element's slot props
 * are present, the props pass through to the intrinsic element unchanged.
 *
 * @typeParam P - The element's generated `Props` shape.
 * @param elementName - The GLib type name the component renders (e.g. `"GtkButton"`).
 * @returns The element's component.
 */
export const createWidgetComponent = <P extends object>(elementName: string): ((props: P) => ReactNode) => {
    let surface: SlotSurface | null = null;
    return (props: P): ReactNode => {
        surface ??= resolveSlotSurface(elementName);
        if (!hasAnySlotProp(props, surface)) return createElement(elementName, props);
        const { rest, wrappers, children } = splitProps(props, surface);
        return createElement(elementName, rest, children, ...wrappers);
    };
};
