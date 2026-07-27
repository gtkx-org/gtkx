import { isRecord } from "@gtkx/utils";
import { createElement, type ElementType, isValidElement, type ReactElement, type ReactNode } from "react";
import type { Props } from "../reconciler/registry.js";

/** The intrinsic element that carries an object-valued prop's element into its parent's named property. */
const Prop = "gtkx:prop";

const hasElement = (value: unknown): boolean =>
    isValidElement(value) || (Array.isArray(value) && value.some((item: unknown) => hasElement(item)));

const routeProp = (key: string, value: unknown, hostProps: Props, propChildren: ReactNode[]): void => {
    if (key !== "ref" && hasElement(value)) {
        propChildren.push(
            createElement(Prop, { propName: key, key: `${Prop}:${key}` }, value as ReactNode),
        );
    } else {
        hostProps[key] = value;
    }
};

const buildElement = (typeName: string, record: Props): ReactElement => {
    const Host = typeName as ElementType;
    const hostProps: Props = {};
    const propChildren: ReactNode[] = [];

    for (const key in record) {
        if (key === "children") {
            continue;
        }

        routeProp(key, record[key], hostProps, propChildren);
    }

    return (
        <Host {...hostProps}>
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
