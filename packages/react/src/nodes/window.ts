import * as Adw from "@gtkx/ffi/adw";
import * as Gtk from "@gtkx/ffi/gtk";
import type { Node } from "../node.js";
import { registerNodeClass } from "../registry.js";
import type { Container, ContainerClass, Props } from "../types.js";
import { filterProps, isContainerType } from "./internal/utils.js";
import { Menu } from "./models/menu.js";
import { WidgetNode } from "./widget.js";

const PROPS = ["defaultWidth", "defaultHeight"];

type WindowProps = Props & {
    defaultWidth?: number;
    defaultHeight?: number;
};

class WindowNode extends WidgetNode<Gtk.Window, WindowProps> {
    public static override priority = 1;

    private menu: Menu;

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
                throw new Error("Expected ApplicationWindow to be created within Application");
            }

            if (isContainerType(Adw.ApplicationWindow, WindowClass)) {
                return new Adw.ApplicationWindow(rootContainer);
            }

            return new Gtk.ApplicationWindow(rootContainer);
        }

        return WidgetNode.createContainer(props, containerClass) as Gtk.Window;
    }

    constructor(typeName: string, props: WindowProps, container: Gtk.Window, rootContainer?: Container) {
        super(typeName, props, container, rootContainer);
        const application = rootContainer instanceof Gtk.Application ? rootContainer : undefined;
        const actionMap = container instanceof Gtk.ApplicationWindow ? container : undefined;
        this.menu = new Menu("root", {}, actionMap, application);
    }

    public override appendChild(child: Node): void {
        if (child.container instanceof Gtk.Window) {
            child.container.setTransientFor(this.container);
            return;
        }

        this.menu.appendChild(child);
        super.appendChild(child);
    }

    public override removeChild(child: Node): void {
        if (child.container instanceof Gtk.Window) {
            child.container.setTransientFor(undefined);
            return;
        }

        this.menu.removeChild(child);
        super.removeChild(child);
    }

    public override insertBefore(child: Node, before: Node): void {
        this.menu.insertBefore(child, before);
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
