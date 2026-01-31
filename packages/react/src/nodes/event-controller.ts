import * as Gtk from "@gtkx/ffi/gtk";
import { CONTROLLER_CONSTRUCTOR_PROPS } from "../generated/internal.js";
import { Node } from "../node.js";
import type { Container, Props } from "../types.js";
import type { SignalHandler } from "./internal/signal-store.js";
import { propNameToSignalName, resolvePropMeta, resolveSignal } from "./internal/utils.js";
import { WidgetNode } from "./widget.js";

const G_TYPE_INVALID = 0;

export class EventControllerNode<T extends Gtk.EventController = Gtk.EventController> extends Node<T, Props> {
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

    public override canAcceptChild(_child: Node): boolean {
        return false;
    }

    public override onAddedToParent(parent: Node): void {
        if (parent instanceof WidgetNode) {
            this.parentWidget = parent.container;
            parent.container.addController(this.container);
        }
    }

    public override onRemovedFromParent(_parent: Node): void {
        if (this.parentWidget) {
            this.parentWidget.removeController(this.container);
        }
        this.parentWidget = null;
    }

    public override commitUpdate(oldProps: Props | null, newProps: Props): void {
        this.props = newProps;
        this.applyProps(oldProps, newProps);
    }

    public override detachDeletedInstance(): void {
        if (this.parentWidget) {
            this.parentWidget.removeController(this.container);
        }
        this.parentWidget = null;
        super.detachDeletedInstance();
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
