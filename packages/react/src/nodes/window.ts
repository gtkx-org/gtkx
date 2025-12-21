import { getNativeObject } from "@gtkx/ffi";
import * as Adw from "@gtkx/ffi/adw";
import * as Gio from "@gtkx/ffi/gio";
import * as Gtk from "@gtkx/ffi/gtk";
import type { Node } from "../node.js";
import { registerNodeClass } from "../registry.js";
import type { Container, ContainerClass, Props } from "../types.js";
import { filterProps, isContainerType } from "./internal/helpers.js";
import { MenuNode } from "./menu.js";
import { WidgetNode } from "./widget.js";

const PROPS = ["defaultWidth", "defaultHeight"];

type WindowProps = Props & {
    defaultWidth?: number;
    defaultHeight?: number;
};

export class WindowNode extends WidgetNode<Gtk.Window, WindowProps> {
    public static override priority = 1;

    public static override matches(_type: string, containerOrClass?: Container | ContainerClass): boolean {
        return isContainerType(Gtk.Window, containerOrClass);
    }

    public static override createContainer(
        props: Props,
        containerClass: typeof Gtk.Window,
        rootContainer?: Container,
    ): Gtk.Window {
        const WindowClass = containerClass as typeof Gtk.Window;

        if (
            isContainerType(Gtk.ApplicationWindow, WindowClass) ||
            isContainerType(Adw.ApplicationWindow, WindowClass)
        ) {
            if (!(rootContainer instanceof Gtk.Application)) {
                throw new Error("ApplicationWindow can only be created inside an Application");
            }

            if (isContainerType(Adw.ApplicationWindow, WindowClass)) {
                return new Adw.ApplicationWindow(rootContainer);
            }

            return new Gtk.ApplicationWindow(rootContainer);
        }

        return WidgetNode.createContainer(props, containerClass) as Gtk.Window;
    }

    public override appendChild(child: Node): void {
        if (child.container instanceof Gtk.Window) {
            child.container.setTransientFor(this.container);
            return;
        }

        if (child instanceof MenuNode && this.container instanceof Gtk.ApplicationWindow) {
            child.setActionMap(getNativeObject(this.container.id, Gio.ActionMap) ?? undefined);
            return;
        }

        super.appendChild(child);
    }

    public override removeChild(child: Node): void {
        if (child.container instanceof Gtk.Window) {
            child.container.setTransientFor(undefined);
            return;
        }

        if (child instanceof MenuNode && this.container instanceof Gtk.ApplicationWindow) {
            child.setActionMap(undefined);
        }

        super.removeChild(child);
    }

    public override insertBefore(child: Node): void {
        this.appendChild(child);
    }

    public override mount(): void {
        this.container.present();
        super.mount();
    }

    public override unmount(): void {
        this.container.destroy();
        super.unmount();
    }

    public override updateProps(oldProps: WindowProps | null, newProps: WindowProps): void {
        if (
            !oldProps ||
            oldProps.defaultWidth !== newProps.defaultWidth ||
            oldProps.defaultHeight !== newProps.defaultHeight
        ) {
            const width = newProps.defaultWidth ?? -1;
            const height = newProps.defaultHeight ?? -1;
            this.container.setDefaultSize(width, height);
        }

        super.updateProps(filterProps(oldProps ?? {}, PROPS), filterProps(newProps, PROPS));
    }
}

registerNodeClass(WindowNode);
