import { Node } from "../../node.js";
import type { Props } from "../../types.js";
import type { WidgetNode } from "../widget.js";
import { applyProps } from "./apply-props.js";

/**
 * Base reconciler node for a non-widget GObject that attaches to a parent
 * {@link WidgetNode} (for example an event controller or a layout manager).
 *
 * Subclasses own the attach/detach lifecycle against the parent widget; this
 * base provides the shared `commitUpdate` that applies JSX props to the
 * container through {@link applyProps} with `defaultBlockable` disabled, so
 * every declared prop is written even when the prop table marks it blockable.
 *
 * @typeParam TContainer - The wrapped GObject type.
 * @typeParam TChild - The reconciler child node type.
 */
export abstract class WidgetAttachmentNode<
    TContainer,
    // biome-ignore lint/suspicious/noExplicitAny: Self-referential type bounds require any
    TChild extends Node = any,
> extends Node<TContainer, Props, WidgetNode, TChild> {
    public override commitUpdate(oldProps: Props | null, newProps: Props): void {
        super.commitUpdate(oldProps, newProps);
        applyProps(this, oldProps, newProps, { table: this.getPropTable(), defaultBlockable: false });
    }
}
