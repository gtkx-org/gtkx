/// <reference types="@gtkx/config/virtual" />

/**
 * The generic component factory behind every generated `@gtkx/jsx` element.
 *
 * A generated namespace module emits one line per element —
 * `export const GtkButton = createWidgetComponent("GtkButton")` — instead of
 * a per-widget component body. The factory routes each prop by its value: a
 * prop holding a JSX element mounts as a `kind="slot"` wrapper the reconciler's
 * element map sets on the GObject property of the same name (setter semantics),
 * while a constructed GObject instance, a primitive, or `null` is forwarded
 * verbatim as a plain prop — a direct property set the reconciler already makes.
 * Container-slot props (the append-method names in `CONTAINER_SLOTS`, resolved
 * at first render against the element's GType ancestry) become
 * `kind="container-slot"` wrappers (append semantics through the named method).
 *
 * Slot-ness is therefore decided by value, not by a generated table: any
 * GObject-class prop accepts a JSX subtree without being enumerated anywhere.
 */
import { CONTAINER_SLOTS } from "virtual:gtkx-config";
import { getNativeClassByName } from "@gtkx/ffi";
import { createElement, isValidElement, type ReactNode } from "react";
import { classHasType, type GTyped } from "./gtype-predicates.js";
import { WRAPPER_NODE_ELEMENT } from "./instance.js";

const EMPTY_CONTAINER_SLOTS: ReadonlySet<string> = new Set();

const containerSlotCache = new Map<string, ReadonlySet<string>>();

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

const resolveContainerSlots = (elementName: string): ReadonlySet<string> => {
    const cached = containerSlotCache.get(elementName);
    if (cached) return cached;
    const cls = getNativeClassByName(elementName) as { readonly prototype: GTyped } | null;
    const set = cls ? new Set(collectInherited(CONTAINER_SLOTS, cls)) : EMPTY_CONTAINER_SLOTS;
    containerSlotCache.set(elementName, set);
    return set;
};

/**
 * Whether `props` carries anything the factory must lift out of the plain prop
 * bag: a container-slot prop, or a prop whose value is a JSX element (a slot
 * subtree). When neither is present every prop is a direct GObject set and the
 * props pass through to the intrinsic element untouched.
 */
const needsSplit = (props: object, containerSet: ReadonlySet<string>): boolean => {
    for (const [name, value] of Object.entries(props)) {
        if (name === "children") continue;
        if (containerSet.has(name)) return true;
        if (isValidElement(value)) return true;
    }
    return false;
};

type SplitProps = {
    readonly rest: Record<string, unknown>;
    readonly wrappers: ReactNode[];
    readonly children: ReactNode;
};

const splitProps = (props: object, containerSet: ReadonlySet<string>): SplitProps => {
    const rest: Record<string, unknown> = {};
    const wrappers: ReactNode[] = [];
    let children: ReactNode = null;
    for (const [name, value] of Object.entries(props)) {
        if (name === "children") {
            children = value as ReactNode;
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
        if (isValidElement(value)) {
            wrappers.push(
                createElement(
                    WRAPPER_NODE_ELEMENT,
                    { kind: "slot", propName: name, key: `slot:${name}` },
                    value as ReactNode,
                ),
            );
            continue;
        }
        rest[name] = value;
    }
    return { rest, wrappers, children };
};

/**
 * Builds the component for one generated JSX element.
 *
 * The component lifts element-valued props into `kind="slot"` wrapper children
 * and container-slot props into `kind="container-slot"` wrapper children
 * (resolved from `CONTAINER_SLOTS` against the element's GType ancestry),
 * rendering both after the regular children, and forwards every other prop to
 * the intrinsic element. When nothing needs lifting, the props pass through to
 * the intrinsic element unchanged.
 *
 * @typeParam P - The element's generated `Props` shape.
 * @param elementName - The GLib type name the component renders (e.g. `"GtkButton"`).
 * @returns The element's component.
 */
export const createWidgetComponent = <P extends object>(elementName: string): ((props: P) => ReactNode) => {
    let containerSet: ReadonlySet<string> | null = null;
    return (props: P): ReactNode => {
        containerSet ??= resolveContainerSlots(elementName);
        if (!needsSplit(props, containerSet)) return createElement(elementName, props);
        const { rest, wrappers, children } = splitProps(props, containerSet);
        return createElement(elementName, rest, children, ...wrappers);
    };
};
