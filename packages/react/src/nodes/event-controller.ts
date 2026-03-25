import * as Gtk from "@gtkx/ffi/gtk";
import { isConstructOnlyProp, resolvePropMeta, resolveSignal } from "../metadata.js";
import { Node } from "../node.js";
import type { Props } from "../types.js";
import { createContainerWithProperties } from "./internal/construct.js";
import type { SignalHandler } from "./internal/signal-store.js";
import { WidgetNode } from "./widget.js";

const G_TYPE_INVALID = 0;

export class EventControllerNode<
    T extends Gtk.EventController = Gtk.EventController,
    // biome-ignore lint/suspicious/noExplicitAny: Self-referential type bounds require any
    TChild extends Node = any,
> extends Node<T, Props, WidgetNode, TChild> {
    public static override createContainer(
        props: Props,
        containerClass: typeof Gtk.EventController,
    ): Gtk.EventController {
        if (containerClass.glibTypeName === "GtkDropTarget") {
            const actions = (props.actions as number | undefined) ?? 0;
            return new Gtk.DropTarget(G_TYPE_INVALID, actions);
        }

        return createContainerWithProperties(containerClass, props) as Gtk.EventController;
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
        this.applyOwnProps(oldProps, newProps);
    }

    public override detachDeletedInstance(): void {
        if (this.parent && this.container.getWidget() === this.parent.container) {
            this.parent.container.removeController(this.container);
        }
        super.detachDeletedInstance();
    }

    private applyOwnProps(oldProps: Props | null, newProps: Props): void {
        const propNames = new Set([...Object.keys(oldProps ?? {}), ...Object.keys(newProps ?? {})]);

        for (const name of propNames) {
            if (name === "children") continue;
            if (isConstructOnlyProp(this.container, name)) continue;

            const oldValue = oldProps?.[name];
            const newValue = newProps[name];

            if (oldValue === newValue) continue;

            const signalName = resolveSignal(this.container, name);

            if (signalName) {
                const handler = typeof newValue === "function" ? (newValue as SignalHandler) : undefined;
                this.signalStore.set(this, this.container, signalName, handler, { blockable: false });
            } else if (newValue !== undefined) {
                this.setProperty(name, newValue);
            }
        }
    }

    private setProperty(name: string, value: unknown): void {
        if (name === "types" && this.container instanceof Gtk.DropTarget) {
            const types = value as number[];
            this.container.setGtypes(types.length, types);
            return;
        }

        const propName = resolvePropMeta(this.container, name);

        if (propName) {
            (this.container as unknown as Record<string, unknown>)[propName] = value;
        }
    }
}
