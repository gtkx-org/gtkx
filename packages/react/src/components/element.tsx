import { isRecord } from "@gtkx/utils";
import { type ElementType, isValidElement, type ReactElement, type ReactNode } from "react";
import type { Props } from "../reconciler/elements.js";

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

const buildElement = (typeName: string, record: Props): ReactElement => {
    const Host = typeName as ElementType;
    const hostProps: Props = {};
    const propChildren: ReactNode[] = [];
    for (const key in record) {
        const value = record[key];
        if (key === "children") continue;
        if (key !== "ref" && containsElement(value)) {
            propChildren.push(
                <Prop propName={key} key={`${Prop}:${key}`}>
                    {value as ReactNode}
                </Prop>,
            );
        } else {
            hostProps[key] = value;
        }
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
