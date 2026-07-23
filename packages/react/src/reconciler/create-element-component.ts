import { typeFromName } from "@gtkx/gi/gobject";
import { createElement, isValidElement, type ReactNode } from "react";
import { collectContainerPropNames } from "./element-props.js";
import { ELEMENT_KIND, PROP_KIND, WRAPPER_ELEMENT } from "./wrapper-kinds.js";

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

const propWrapper = (name: string, value: ReactNode): ReactNode =>
    createElement(WRAPPER_ELEMENT, { kind: PROP_KIND, propName: name, key: `prop:${name}` }, value);

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
            if (value != null) wrappers.push(propWrapper(name, value as ReactNode));
            continue;
        }
        if (isValidElement(value)) {
            wrappers.push(propWrapper(name, value));
            continue;
        }
        rest[name] = value;
    }
    return { rest, wrappers, children };
};

export const createElementComponent = <P extends object>(elementName: string): ((props: P) => ReactNode) => {
    const containerPropNames = collectContainerPropNames(typeFromName(elementName));
    return (props: P): ReactNode => {
        if (!needsSplit(props, containerPropNames)) return createElement(elementName, props);
        const { rest, wrappers, children } = splitProps(props, containerPropNames);
        return createElement(elementName, rest, children, ...wrappers);
    };
};

const NO_CONTAINER_PROPS: Set<string> = new Set();

export const createWrapperElementComponent = <P extends object>(): ((props: P) => ReactNode) => {
    return (props: P): ReactNode => {
        const { rest, wrappers, children } = splitProps(props, NO_CONTAINER_PROPS);
        return createElement(WRAPPER_ELEMENT, { kind: ELEMENT_KIND, ...rest }, children, ...wrappers);
    };
};
