/// <reference types="@gtkx/config/env" />

import { CONTAINER_PROPS } from "virtual:gtkx-config";
import { CONTAINER_PROP_KIND, SLOT_KIND } from "@gtkx/config";
import { createElement, isValidElement, type ReactNode } from "react";
import { WRAPPER_NODE_ELEMENT } from "../reconciler/instance.js";
import { foldInheritedTable } from "./gtype.js";
import { resolveBackingClass } from "./gtype-predicates.js";

const EMPTY_CONTAINER_PROPS: Set<string> = new Set();

const containerPropCache = new Map<string, Set<string>>();

const resolveContainerProps = (elementName: string): Set<string> => {
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

const needsSplit = (props: object, containerSet: Set<string>): boolean => {
    for (const [name, value] of Object.entries(props)) {
        if (name === "children") continue;
        if (containerSet.has(name)) return true;
        if (isValidElement(value)) return true;
    }
    return false;
};

type SplitProps = {
    rest: Record<string, unknown>;
    wrappers: ReactNode[];
    children: ReactNode;
};

const splitProps = (props: object, containerSet: Set<string>): SplitProps => {
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
 * Builds a React component for a GTK element name that splits container props and element-valued
 * props into reconciler wrapper nodes before delegating to the intrinsic element.
 *
 * @typeParam P - The props type accepted by the produced component.
 * @param elementName - The GTK element (intrinsic) name to render.
 * @returns A function component rendering `elementName` with container/slot props extracted.
 */
export const createElementComponent = <P extends object>(elementName: string): ((props: P) => ReactNode) => {
    const containerSet = resolveContainerProps(elementName);
    return (props: P): ReactNode => {
        if (!needsSplit(props, containerSet)) return createElement(elementName, props);
        const { rest, wrappers, children } = splitProps(props, containerSet);
        return createElement(elementName, rest, children, ...wrappers);
    };
};
