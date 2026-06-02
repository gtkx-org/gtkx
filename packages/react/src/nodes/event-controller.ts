import type * as Gdk from "@gtkx/gi/gdk";
import { G_TYPE_INVALID, type GType } from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import type { Node } from "../node.js";
import type { Props } from "../types.js";
import { imperative, type PropDescriptorTable } from "./internal/apply-props.js";
import { createContainerWithProperties } from "./internal/construct.js";
import { WidgetAttachmentNode } from "./internal/widget-attachment.js";
import { WidgetNode } from "./widget.js";

export class EventControllerNode<
    T extends Gtk.EventController = Gtk.EventController,
    // biome-ignore lint/suspicious/noExplicitAny: Self-referential type bounds require any
    TChild extends Node = any,
> extends WidgetAttachmentNode<T, TChild> {
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
        return this.backingInstance instanceof Gtk.ShortcutController && child.typeName === "Shortcut";
    }

    public override isValidParent(parent: Node): boolean {
        return parent instanceof WidgetNode;
    }

    public override setParent(parent: WidgetNode | null): void {
        if (!parent && this.parent) {
            this.parent.backingInstance.removeController(this.backingInstance);
        }

        super.setParent(parent);

        if (parent) {
            parent.backingInstance.addController(this.backingInstance);
        }
    }

    protected override ownPropDescriptors(): PropDescriptorTable {
        return {
            ...super.ownPropDescriptors(),
            types: imperative(() => {
                if (this.backingInstance instanceof Gtk.DropTarget) {
                    this.backingInstance.setGtypes(this.props.types as GType[]);
                }
            }),
        };
    }

    public override detachDeletedInstance(): void {
        if (this.backingInstance.getWidget() === this.parent?.backingInstance) {
            this.parent.backingInstance.removeController(this.backingInstance);
        }
        super.detachDeletedInstance();
    }
}
