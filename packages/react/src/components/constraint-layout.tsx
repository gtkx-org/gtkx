import type * as Gtk from "@gtkx/gi/gtk";
import { type ElementType, type ReactNode, type Ref, useLayoutEffect, useRef } from "react";
import type { GtkConstraintLayoutProps } from "../prop-types.js";
import { useMergedRef } from "../hooks/use-merged-refs.js";

type ConstraintLayoutProps = GtkConstraintLayoutProps & { ref?: Ref<Gtk.ConstraintLayout> };

const createConstraintLayoutComponent = (
    Component: ElementType,
): ((props: ConstraintLayoutProps) => ReactNode) => {
    const ConstraintLayout = ({ vfl, ref, ...props }: ConstraintLayoutProps): ReactNode => {
        const layoutRef = useRef<Gtk.ConstraintLayout | null>(null);
        const mergedRef = useMergedRef(ref, layoutRef);

        useLayoutEffect(() => {
            const layout = layoutRef.current;

            if (layout === null) {
                return;
            }

            const constraints = (vfl ?? []).flatMap((item) => layout.addConstraintsFromDescription(
                item.lines,
                item.hspacing ?? 0,
                item.vspacing ?? 0,
                item.views ?? new Map<string, Gtk.ConstraintTarget>(),
            ));

            return () => {
                for (const constraint of constraints) {
                    layout.removeConstraint(constraint);
                }
            };
        }, [vfl]);

        return <Component {...props} ref={mergedRef} />;
    };

    return ConstraintLayout;
};

export { createConstraintLayoutComponent };
