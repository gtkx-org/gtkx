/// <reference types="@gtkx/config/env" />

import { CONTAINER_PROPS } from "virtual:gtkx-config";
import { CONTAINER_PROP_KIND, type ContainerPropRow, SLOT_KIND } from "@gtkx/config";
import { createElement, isValidElement, type ReactNode } from "react";
import { WRAPPER_NODE_ELEMENT } from "../reconciler/instance.js";
import { foldInheritedTable } from "./gtype.js";
import { resolveBackingClass } from "./gtype-predicates.js";

type ContainerPropMap = Map<string, ContainerPropRow>;

const EMPTY_CONTAINER_PROPS: ContainerPropMap = new Map();

const containerPropCache = new Map<string, ContainerPropMap>();

const resolveContainerProps = (elementName: string): ContainerPropMap => {
    const cached = containerPropCache.get(elementName);
    if (cached) return cached;
    const cls = resolveBackingClass(elementName);
    const map = cls
        ? foldInheritedTable(
              cls.prototype.__gtype__,
              CONTAINER_PROPS,
              (collected: ContainerPropMap, rows) => {
                  for (const [propName, row] of Object.entries(rows)) collected.set(propName, row);
                  return collected;
              },
              new Map<string, ContainerPropRow>(),
          )
        : EMPTY_CONTAINER_PROPS;
    containerPropCache.set(elementName, map);
    return map;
};

const needsSplit = (props: object, containerMap: ContainerPropMap): boolean => {
    for (const [name, value] of Object.entries(props)) {
        if (name === "children") continue;
        if (containerMap.has(name)) return true;
        if (isValidElement(value)) return true;
    }
    return false;
};

type SplitProps = {
    rest: Record<string, unknown>;
    wrappers: ReactNode[];
    children: ReactNode;
};

const splitProps = (props: object, containerMap: ContainerPropMap): SplitProps => {
    const rest: Record<string, unknown> = {};
    const wrappers: ReactNode[] = [];
    let children: ReactNode = null;
    for (const [name, value] of Object.entries(props)) {
        if (name === "children") {
            children = value as ReactNode;
            continue;
        }
        const verb = containerMap.get(name);
        if (verb) {
            if (value != null) {
                wrappers.push(
                    createElement(
                        WRAPPER_NODE_ELEMENT,
                        { kind: CONTAINER_PROP_KIND, propName: name, verb, key: `container-slot:${name}` },
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

export const createElementComponent = <P extends object>(elementName: string): ((props: P) => ReactNode) => {
    const containerMap = resolveContainerProps(elementName);
    return (props: P): ReactNode => {
        if (!needsSplit(props, containerMap)) return createElement(elementName, props);
        const { rest, wrappers, children } = splitProps(props, containerMap);
        return createElement(elementName, rest, children, ...wrappers);
    };
};
