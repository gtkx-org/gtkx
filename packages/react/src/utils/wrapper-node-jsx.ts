import type * as Gdk from "@gtkx/gi/gdk";
import type { ReactNode } from "react";

/**
 * Props for a text anchor that embeds child widgets at a position within a text view's buffer.
 */
export type TextAnchorProps = {
    /** The character used to represent the embedded widget in the buffer's text. */
    replacementChar?: string;
    children?: ReactNode;
};

/**
 * Props for a node that embeds a `Gdk.Paintable` within a text view's buffer.
 */
export type TextPaintableProps = {
    paintable: Gdk.Paintable;
};

type WrapperNodeElementProps = {
    kind: string;
    children?: ReactNode;
    [key: string]: unknown;
};

declare global {
    namespace React {
        namespace JSX {
            interface IntrinsicElements {
                __GTKX_WRAPPER_NODE__: WrapperNodeElementProps;
            }
        }
    }
}
