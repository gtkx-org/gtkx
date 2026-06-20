/// <reference types="@gtkx/config/virtual" />

/**
 * The generic component factory behind every generated `@gtkx/jsx` element.
 *
 * A generated namespace module emits one line per element —
 * `export const GtkButton = createElementComponent("GtkButton")` — instead of
 * a per-element component body. The factory routes each prop by its value: a
 * prop holding a JSX element mounts as a `kind="slot"` wrapper the reconciler's
 * element map sets on the GObject property of the same name (setter semantics),
 * while a constructed GObject instance, a primitive, or `null` is forwarded
 * verbatim as a plain prop — a direct property set the reconciler already makes.
 * Container-slot props (the append-method names in `CONTAINER_PROPS`, resolved
 * at first render against the element's GType ancestry) become
 * `kind="container-slot"` wrappers (append semantics through the named method).
 *
 * Slot-ness is therefore decided by value, not by a generated table: any
 * GObject-class prop accepts a JSX subtree without being enumerated anywhere.
 */
import { CONTAINER_PROPS } from "virtual:gtkx-config";
import { CONTAINER_PROP_KIND, SLOT_KIND } from "@gtkx/config";
import { createElement, isValidElement, type ReactNode } from "react";
import { WRAPPER_NODE_ELEMENT } from "../reconciler/instance.js";
import { resolveBackingClass } from "./gtype-predicates.js";
import { foldInheritedTable } from "./gtype.js";

const EMPTY_CONTAINER_PROPS: ReadonlySet<string> = new Set();

const containerPropCache = new Map<string, ReadonlySet<string>>();

const resolveContainerProps = (elementName: string): ReadonlySet<string> => {
    const cached = containerPropCache.get(elementName);
    if (cached) return cached;
    const cls = resolveBackingClass(elementName);
    const set = cls
        ? foldInheritedTable(
              cls.prototype.__gtype__,
              CONTAINER_PROPS,
              (collected: Set<string>, names) => {
                  for (const name of names) collected.add(name);
                  return collected;
              },
              new Set<string>(),
          )
        : EMPTY_CONTAINER_PROPS;
    containerPropCache.set(elementName, set);
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
                        { kind: CONTAINER_PROP_KIND, method: name, key: `container-slot:${name}` },
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
                    { kind: SLOT_KIND, propName: name, key: `slot:${name}` },
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
 * (resolved from `CONTAINER_PROPS` against the element's GType ancestry),
 * rendering both after the regular children, and forwards every other prop to
 * the intrinsic element. When nothing needs lifting, the props pass through to
 * the intrinsic element unchanged.
 *
 * @typeParam P - The element's generated `Props` shape.
 * @param elementName - The GLib type name the component renders (e.g. `"GtkButton"`).
 * @returns The element's component.
 */
export const createElementComponent = <P extends object>(elementName: string): ((props: P) => ReactNode) => {
    let containerSet: ReadonlySet<string> | null = null;
    return (props: P): ReactNode => {
        containerSet ??= resolveContainerProps(elementName);
        if (!needsSplit(props, containerSet)) return createElement(elementName, props);
        const { rest, wrappers, children } = splitProps(props, containerSet);
        return createElement(elementName, rest, children, ...wrappers);
    };
};
