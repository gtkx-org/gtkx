import { createElement, isValidElement, type ReactNode } from "react";
import { containerPropNamesFor } from "../reconciler/element-props.js";
import {
    CONTAINER_PROP_KIND,
    LAZY_ELEMENT_KIND,
    OBJECT_PROP_KIND,
    WRAPPER_NODE_ELEMENT,
} from "../reconciler/wrapper-protocol.js";

const needsSplit = (props: object, containerPropNames: Set<string>): boolean => {
    for (const [name, value] of Object.entries(props)) {
        if (name === "children") continue;
        if (containerPropNames.has(name)) return true;
        if (isValidElement(value)) return true;
    }
    return false;
};

type SplitProps = {
    rest: Record<string, unknown>;
    wrappers: ReactNode[];
    children: ReactNode;
};

const splitProps = (props: object, containerPropNames: Set<string>): SplitProps => {
    const rest: Record<string, unknown> = {};
    const wrappers: ReactNode[] = [];
    let children: ReactNode = null;
    for (const [name, value] of Object.entries(props)) {
        if (name === "children") {
            children = value as ReactNode;
            continue;
        }
        if (containerPropNames.has(name)) {
            if (value != null) {
                wrappers.push(
                    createElement(
                        WRAPPER_NODE_ELEMENT,
                        { kind: CONTAINER_PROP_KIND, propName: name, key: `container-prop:${name}` },
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
                    { kind: OBJECT_PROP_KIND, propName: name, key: `object-prop:${name}` },
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
    const containerPropNames = containerPropNamesFor(elementName);
    return (props: P): ReactNode => {
        if (!needsSplit(props, containerPropNames)) return createElement(elementName, props);
        const { rest, wrappers, children } = splitProps(props, containerPropNames);
        return createElement(elementName, rest, children, ...wrappers);
    };
};

const NO_CONTAINER_PROPS: Set<string> = new Set();

export const createLazyElementComponent = <P extends object>(): ((props: P) => ReactNode) => {
    return (props: P): ReactNode => {
        const { rest, wrappers, children } = splitProps(props, NO_CONTAINER_PROPS);
        return createElement(WRAPPER_NODE_ELEMENT, { kind: LAZY_ELEMENT_KIND, ...rest }, children, ...wrappers);
    };
};
