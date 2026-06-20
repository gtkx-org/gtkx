import type * as Gtk from "@gtkx/gi/gtk";
import type { ElementType, ReactNode, Ref } from "react";
import { useForwardedRef } from "../hooks/use-forwarded-ref.js";
import { type TopLevelSurface, useWindowPresentation } from "../hooks/use-window-presentation.js";

export interface TopLevelParentProps {
    parent?: Gtk.Window | null;
}

export const withTopLevel = <P extends { children?: ReactNode }>(
    Underlying: ElementType,
): ((props: P) => ReactNode) => {
    const Element = Underlying;
    return (props: P): ReactNode => {
        const externalRef = (props as { ref?: Ref<TopLevelSurface | null> }).ref;
        const { children, parent, ...rest } = props as P & TopLevelParentProps;
        const capture = useWindowPresentation(parent ?? null);
        const [, ref] = useForwardedRef(externalRef, capture);
        return (
            <Element {...rest} ref={ref}>
                {children}
            </Element>
        );
    };
};
