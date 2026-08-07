import { isRecord } from "@gtkx/utils";
import { createElement, type ElementType, isValidElement, type ReactElement, type ReactNode } from "react";
import type { Props } from "../reconciler/registry.js";

const Prop = "gtkx:prop";
const NO_PROP_CHILDREN: ReactNode[] = [];

const hasElement = (value: unknown): boolean =>
    isValidElement(value) || (Array.isArray(value) && value.some((item: unknown) => hasElement(item)));

const isRoutedProp = (key: string, value: unknown): boolean =>
    key !== "children" && key !== "ref" && hasElement(value);

const collectPropChildren = (record: Props): ReactNode[] | null => {
    let propChildren: ReactNode[] | null = null;

    for (const key in record) {
        if (!isRoutedProp(key, record[key])) {
            continue;
        }

        propChildren ??= [];

        propChildren.push(
            createElement(Prop, { propName: key, key: `${Prop}:${key}` }, record[key] as ReactNode),
        );
    }

    return propChildren;
};

const hostPropsWithout = (record: Props): Props => {
    const hostProps: Props = {};

    for (const key in record) {
        if (key !== "children" && !isRoutedProp(key, record[key])) {
            hostProps[key] = record[key];
        }
    }

    return hostProps;
};

const buildElement = (typeName: string, record: Props): ReactElement => {
    const Host = typeName as ElementType;
    const propChildren = collectPropChildren(record);

    if (propChildren === null) {
        return (
            <Host {...record}>
                {NO_PROP_CHILDREN}
                {record.children as ReactNode}
            </Host>
        );
    }

    return (
        <Host {...hostPropsWithout(record)}>
            {propChildren}
            {record.children as ReactNode}
        </Host>
    );
};

const createElementComponent =
    (typeName: string): ((props: unknown) => ReactNode) =>
        (props: unknown): ReactNode =>
            buildElement(typeName, isRecord(props) ? props : {});

export { Prop, createElementComponent };
