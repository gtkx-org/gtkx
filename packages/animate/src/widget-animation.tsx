import type * as Gtk from "@gtkx/gi/gtk";
import { Children, cloneElement, type ReactElement, type ReactNode, type Ref } from "react";
import type { WidgetAnimationProps } from "./types.js";
import { useAnimatedWidget } from "./use-animated-widget.js";

type WidgetChild = ReactElement<{ ref?: Ref<Gtk.Widget | null> }>;

export const WidgetAnimation = (props: WidgetAnimationProps): ReactNode => {
    const child = Children.only(props.children) as WidgetChild;
    const mergedRef = useAnimatedWidget(child.props.ref, props);
    return cloneElement(child, { ref: mergedRef });
};
