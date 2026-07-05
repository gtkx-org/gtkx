import { COMPANION_KIND, CONTAINER_SLOT_KIND, WIDGET_PROP_KIND, WRAPPER_NODE_ELEMENT } from "@gtkx/config";
import { createElement, isValidElement, type ReactNode } from "react";
import { slotPropsFor } from "../reconciler/rule-table.js";

const needsSplit = (props: object, slotProps: Set<string>): boolean => {
    for (const [name, value] of Object.entries(props)) {
        if (name === "children") continue;
        if (slotProps.has(name)) return true;
        if (isValidElement(value)) return true;
    }
    return false;
};

type SplitProps = {
    rest: Record<string, unknown>;
    wrappers: ReactNode[];
    children: ReactNode;
};

const splitProps = (props: object, slotProps: Set<string>): SplitProps => {
    const rest: Record<string, unknown> = {};
    const wrappers: ReactNode[] = [];
    let children: ReactNode = null;
    for (const [name, value] of Object.entries(props)) {
        if (name === "children") {
            children = value as ReactNode;
            continue;
        }
        if (slotProps.has(name)) {
            if (value != null) {
                wrappers.push(
                    createElement(
                        WRAPPER_NODE_ELEMENT,
                        { kind: CONTAINER_SLOT_KIND, slotTag: name, key: `container-slot:${name}` },
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
                    { kind: WIDGET_PROP_KIND, propName: name, key: `widget-prop:${name}` },
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
    const slotProps = slotPropsFor(elementName);
    return (props: P): ReactNode => {
        if (!needsSplit(props, slotProps)) return createElement(elementName, props);
        const { rest, wrappers, children } = splitProps(props, slotProps);
        return createElement(elementName, rest, children, ...wrappers);
    };
};

const NO_SLOT_PROPS: Set<string> = new Set();

export const createWrapperComponent = <P extends object>(element: string): ((props: P) => ReactNode) => {
    return (props: P): ReactNode => {
        const { rest, wrappers, children } = splitProps(props, NO_SLOT_PROPS);
        return createElement(WRAPPER_NODE_ELEMENT, { kind: COMPANION_KIND, element, ...rest }, children, ...wrappers);
    };
};
