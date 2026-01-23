import * as Gtk from "@gtkx/ffi/gtk";
import { CONTROLLER_CLASSES, CONTROLLER_CONSTRUCTOR_PROPS } from "../generated/internal.js";
import { Node } from "../node.js";
import { registerNodeClass } from "../registry.js";
import type { Container, Props } from "../types.js";
import type { Attachable } from "./internal/predicates.js";
import type { SignalHandler } from "./internal/signal-store.js";
import { propNameToSignalName, resolvePropMeta, resolveSignal } from "./internal/utils.js";
import { WidgetNode } from "./widget.js";

const G_TYPE_INVALID = 0;

export class EventControllerNode<T extends Gtk.EventController = Gtk.EventController>
    extends Node<T, Props>
    implements Attachable
{
    public static override priority = 1;

    public static override matches(type: string): boolean {
        return type in CONTROLLER_CLASSES;
    }

    public static override createContainer(
        props: Props,
        containerClass: typeof Gtk.EventController,
    ): Gtk.EventController {
        const typeName = containerClass.glibTypeName;

        if (typeName === "GtkDropTarget") {
            const actions = (props.actions as number | undefined) ?? 0;
            return new Gtk.DropTarget(G_TYPE_INVALID, actions);
        }

        const args = (CONTROLLER_CONSTRUCTOR_PROPS[typeName] ?? []).map((name) => props[name]);

        // biome-ignore lint/suspicious/noExplicitAny: Dynamic constructor invocation
        return new (containerClass as any)(...args);
    }

    props: Props;
    protected parentWidget: Gtk.Widget | null = null;

    constructor(typeName: string, props: Props, container: T, rootContainer: Container) {
        super(typeName, props, container, rootContainer);
        this.props = props;
    }

    public canBeChildOf(parent: Node): boolean {
        return parent instanceof WidgetNode;
    }

    public override appendChild(_child: Node): void {}
    public override removeChild(_child: Node): void {}
    public override insertBefore(_child: Node, _before: Node): void {}

    public attachTo(parent: Node): void {
        if (parent instanceof WidgetNode) {
            this.parentWidget = parent.container;
            parent.container.addController(this.container);
        }
    }

    public detachFrom(_parent: Node): void {
        if (this.parentWidget) {
            this.parentWidget.removeController(this.container);
        }
        this.parentWidget = null;
    }

    public override updateProps(oldProps: Props | null, newProps: Props): void {
        this.props = newProps;
        this.applyProps(oldProps, newProps);
    }

    public override unmount(): void {
        if (this.parentWidget) {
            this.parentWidget.removeController(this.container);
        }
        this.parentWidget = null;
        super.unmount();
    }

    private applyProps(oldProps: Props | null, newProps: Props): void {
        if (!this.container) {
            throw new Error(`EventControllerNode.applyProps: container is undefined for ${this.typeName}`);
        }

        const propNames = new Set([...Object.keys(oldProps ?? {}), ...Object.keys(newProps ?? {})]);

        for (const name of propNames) {
            if (name === "children") continue;

            const oldValue = oldProps?.[name];
            const newValue = newProps[name];

            if (oldValue === newValue) continue;

            const signalName = propNameToSignalName(name);

            if (resolveSignal(this.container, signalName)) {
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

        const propMeta = resolvePropMeta(this.container, name);

        if (propMeta) {
            const [, setterName] = propMeta;
            const setterFn = (this.container as unknown as Record<string, (v: unknown) => void>)[setterName];
            if (typeof setterFn === "function") {
                setterFn.call(this.container, value);
            }
        }
    }
}

registerNodeClass(EventControllerNode);
