import type { ReactNode } from "react";

export const WRAPPER_ELEMENT = "__GTKX_WRAPPER__";

type WrapperElementProps = {
    kind: string;
    children?: ReactNode;
    [key: string]: unknown;
};

declare global {
    namespace React {
        namespace JSX {
            interface IntrinsicElements {
                [WRAPPER_ELEMENT]: WrapperElementProps;
            }
        }
    }
}

const WRAPPER_KINDS = ["element", "prop", "text"] as const;

export type WrapperKind = (typeof WRAPPER_KINDS)[number];

const WRAPPER_KIND_SET: Set<string> = new Set(WRAPPER_KINDS);

export const isWrapperKind = (value: unknown): value is WrapperKind =>
    typeof value === "string" && WRAPPER_KIND_SET.has(value);

export const ELEMENT_KIND: WrapperKind = "element";

export const PROP_KIND: WrapperKind = "prop";

export const TEXT_KIND: WrapperKind = "text";
