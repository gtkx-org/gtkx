import { isRecord } from "@gtkx/utils";
import { type ElementType, isValidElement, type ReactElement, type ReactNode } from "react";
import type { Props } from "../reconciler/registry.js";

/** The intrinsic element that carries an object-valued prop's element into its parent's named property. */
export const Prop = "gtkx:prop";

declare global {
    namespace React.JSX {
        interface IntrinsicElements {
            [Prop]: { propName: string; children?: React.ReactNode };
        }
    }
}

const containsElement = (value: unknown): boolean =>
    isValidElement(value) || (Array.isArray(value) && value.some(containsElement));

const routeProp = (key: string, value: unknown, hostProps: Props, propChildren: ReactNode[]): void => {
    if (key !== "ref" && containsElement(value)) {
        propChildren.push(
            <Prop propName={key} key={`${Prop}:${key}`}>
                {value as ReactNode}
            </Prop>,
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
        if (key === "children") continue;
        routeProp(key, record[key], hostProps, propChildren);
    }
    return (
        <Host {...hostProps}>
            {propChildren}
            {record.children as ReactNode}
        </Host>
    );
};

export const createElementComponent =
    (typeName: string): ((props: unknown) => ReactNode) =>
        (props: unknown): ReactNode =>
            buildElement(typeName, isRecord(props) ? props : {});
