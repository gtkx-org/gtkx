import * as Adw from "@gtkx/ffi/adw";
import * as Gtk from "@gtkx/ffi/gtk";
import type { Node } from "../node.js";
import type { Container, Props } from "../types.js";
import { DialogNode } from "./dialog.js";
import { filterProps, hasChanged, matchesAnyClass } from "./internal/utils.js";
import { MenuModel } from "./models/menu.js";
import { WidgetNode } from "./widget.js";

const OWN_PROPS = ["defaultWidth", "defaultHeight", "onClose"] as const;

type CreditSection = {
    name: string;
    people: string[];
};

export type WindowProps = Props & {
    defaultWidth?: number;
    defaultHeight?: number;
    onClose?: () => void;
    creditSections?: CreditSection[];
};

export class WindowNode extends WidgetNode<Gtk.Window, WindowProps> {
    private menu: MenuModel;

    public override isValidChild(child: Node): boolean {
        if (child.container instanceof Gtk.Window) {
            return true;
        }
        return super.isValidChild(child);
    }

    public static override createContainer(
        props: Props,
        containerClass: typeof Gtk.Window,
        rootContainer: Container | undefined,
    ): Gtk.Window {
        const WindowClass = containerClass as typeof Gtk.Window;

        if (
            matchesAnyClass([Gtk.ApplicationWindow], WindowClass) ||
            matchesAnyClass([Adw.ApplicationWindow], WindowClass)
        ) {
            if (!(rootContainer instanceof Gtk.Application)) {
                throw new Error("Expected ApplicationWindow to be created within Application");
            }

            if (matchesAnyClass([Adw.ApplicationWindow], WindowClass)) {
                return new Adw.ApplicationWindow(rootContainer);
            }

            return new Gtk.ApplicationWindow(rootContainer);
        }

        return WidgetNode.createContainer(props, containerClass) as Gtk.Window;
    }

    constructor(typeName: string, props: WindowProps, container: Gtk.Window, rootContainer: Container) {
        super(typeName, props, container, rootContainer);
        const application = rootContainer instanceof Gtk.Application ? rootContainer : undefined;
        const actionMap = container instanceof Gtk.ApplicationWindow ? container : undefined;
        this.menu = new MenuModel("root", {}, rootContainer, actionMap, application);

        if (container instanceof Gtk.AboutDialog && props.creditSections) {
            for (const section of props.creditSections) {
                container.addCreditSection(section.name, section.people);
            }
        }
    }

    public override appendChild(child: Node): void {
        if (child.container instanceof Gtk.Window) {
            child.container.setTransientFor(this.container);
            super.appendChild(child);
            return;
        }

        if (child instanceof DialogNode) {
            child.parentWindow = this.container;
            super.appendChild(child);
            return;
        }

        this.menu.appendChild(child);
        super.appendChild(child);
    }

    public override removeChild(child: Node): void {
        if (child.container instanceof Gtk.Window) {
            child.container.setTransientFor(null);
            super.removeChild(child);
            return;
        }

        if (child instanceof DialogNode) {
            child.parentWindow = null;
            super.removeChild(child);
            return;
        }

        this.menu.removeChild(child);
        super.removeChild(child);
    }

    public override insertBefore(child: Node, before: Node): void {
        this.menu.insertBefore(child, before);
        this.appendChild(child);
    }

    public override finalizeInitialChildren(props: WindowProps): boolean {
        this.commitUpdate(null, props);
        return true;
    }

    public override commitMount(): void {
        this.container.present();
    }

    public override detachDeletedInstance(): void {
        this.container.destroy();
        super.detachDeletedInstance();
    }

    public override commitUpdate(oldProps: WindowProps | null, newProps: WindowProps): void {
        super.commitUpdate(oldProps ? filterProps(oldProps, OWN_PROPS) : null, filterProps(newProps, OWN_PROPS));
        this.applyOwnProps(oldProps, newProps);
    }

    private applyOwnProps(oldProps: WindowProps | null, newProps: WindowProps): void {
        if (hasChanged(oldProps, newProps, "defaultWidth") || hasChanged(oldProps, newProps, "defaultHeight")) {
            const width = newProps.defaultWidth ?? -1;
            const height = newProps.defaultHeight ?? -1;
            this.container.setDefaultSize(width, height);
        }

        if (hasChanged(oldProps, newProps, "onClose")) {
            const userHandler = newProps.onClose;
            const wrappedHandler = userHandler
                ? () => {
                      userHandler();
                      return true;
                  }
                : undefined;
            this.signalStore.set(this, this.container, "close-request", wrappedHandler);
        }
    }
}
