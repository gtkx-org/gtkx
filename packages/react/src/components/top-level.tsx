import type * as Gtk from "@gtkx/gi/gtk";
import type { ElementType, ReactNode, Ref } from "react";
import { useMergeRefs } from "../hooks/use-merge-refs.js";
import { useWindowPresentation } from "../hooks/use-window-presentation.js";
import { createPortal } from "../reconciler/portal.js";
import { createRootElement } from "../reconciler/root-element.js";

const toplevelRoot = createRootElement();

export const withWindowPresentation = <P extends { children?: ReactNode }>(
    Underlying: ElementType,
): ((props: P) => ReactNode) => {
    const Element = Underlying;
    return (props: P): ReactNode => {
        const externalRef = (props as { ref?: Ref<Gtk.Window | null> }).ref;
        const { children, ...rest } = props;
        const capture = useWindowPresentation();
        const ref = useMergeRefs(externalRef, capture);
        return createPortal(
            <Element {...rest} ref={ref}>
                {children}
            </Element>,
            toplevelRoot,
        );
    };
};
