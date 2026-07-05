import type * as Gdk from "@gtkx/gi/gdk";
import type { ReactNode } from "react";

export type TextAnchorProps = {
    replacementChar?: string;
    children?: ReactNode;
};

export type TextPaintableProps = {
    paintable: Gdk.Paintable;
};

type RelationshipNodeElementProps = {
    kind: string;
    children?: ReactNode;
    [key: string]: unknown;
};

declare global {
    namespace React {
        namespace JSX {
            interface IntrinsicElements {
                __GTKX_RELATIONSHIP_NODE__: RelationshipNodeElementProps;
            }
        }
    }
}
