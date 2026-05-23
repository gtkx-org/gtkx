import type * as Gdk from "@gtkx/ffi/gdk";
import { G_TYPE_INVALID, type GType } from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import { Node } from "../node.js";
import type { Props } from "../types.js";
import { applyProps, imperative, type PropDescriptorTable } from "./internal/apply-props.js";
import { createContainerWithProperties } from "./internal/construct.js";
import { WidgetNode } from "./widget.js";

export class EventControllerNode<
    T extends Gtk.EventController = Gtk.EventController,
    // biome-ignore lint/suspicious/noExplicitAny: Self-referential type bounds require any
    TChild extends Node = any,
> extends Node<T, Props, WidgetNode, TChild> {
    public static override createContainer(
        typeName: string,
        props: Props,
        containerClass: typeof Gtk.EventController,
    ): Gtk.EventController {
        if (containerClass === Gtk.DropTarget) {
            const actions = (props.actions as Gdk.DragAction | undefined) ?? 0;
            return Gtk.DropTarget.new(G_TYPE_INVALID, actions);
        }

        return createContainerWithProperties(typeName, props) as Gtk.EventController;
    }

    public override isValidChild(child: Node): boolean {
        return this.container instanceof Gtk.ShortcutController && child.typeName === "Shortcut";
    }

    public override isValidParent(parent: Node): boolean {
        return parent instanceof WidgetNode;
    }

    public override setParent(parent: WidgetNode | null): void {
        if (!parent && this.parent) {
            this.parent.container.removeController(this.container);
        }

        super.setParent(parent);

        if (parent) {
            parent.container.addController(this.container);
        }
    }

    public override commitUpdate(oldProps: Props | null, newProps: Props): void {
        super.commitUpdate(oldProps, newProps);
        applyProps(this, oldProps, newProps, { table: this.getPropTable(), defaultBlockable: false });
    }

    protected override ownPropDescriptors(): PropDescriptorTable {
        return {
            ...super.ownPropDescriptors(),
            types: imperative(() => {
                if (this.container instanceof Gtk.DropTarget) {
                    this.container.setGtypes(this.props.types as GType[]);
                }
            }),
        };
    }

    public override detachDeletedInstance(): void {
        if (this.container.getWidget() === this.parent?.container) {
            this.parent.container.removeController(this.container);
        }
        super.detachDeletedInstance();
    }
}
