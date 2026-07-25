import { isRecord } from "@gtkx/utils";
import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { PROP_KIND, type Props } from "./kinds.js";

const containsElement = (value: unknown): boolean =>
    isValidElement(value) || (Array.isArray(value) && value.some(containsElement));

const buildElement = (typeName: string, record: Props): ReactElement => {
    const hostProps: Props = {};
    const propChildren: ReactNode[] = [];
    for (const key in record) {
        const value = record[key];
        if (key === "children") continue;
        if (key !== "ref" && containsElement(value)) {
            propChildren.push(createElement(PROP_KIND, { propName: key, key: `gtkx:prop:${key}` }, value as ReactNode));
        } else {
            hostProps[key] = value;
        }
    }
    return createElement(typeName, hostProps, propChildren, record.children as ReactNode);
};

/**
 * Builds a React component for a GObject type: rendering it instantiates the named GObject and applies its props.
 *
 * @param typeName The GObject type name to instantiate.
 * @returns A component that renders the named GObject.
 */
export const createElementComponent =
    (typeName: string): ((props: unknown) => ReactNode) =>
    (props: unknown): ReactNode =>
        buildElement(typeName, isRecord(props) ? props : {});
