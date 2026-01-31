import * as Adw from "@gtkx/ffi/adw";
import * as Gtk from "@gtkx/ffi/gtk";
import type { Node } from "../node.js";
import type { Container, Props } from "../types.js";
import { DialogNode } from "./dialog.js";
import { hasChanged, matchesAnyClass } from "./internal/utils.js";
import { MenuNode } from "./menu.js";
import { MenuModel } from "./models/menu.js";
import type { SlotNode } from "./slot.js";
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

type WindowChild = WindowNode | DialogNode | MenuNode | SlotNode | WidgetNode;

export class WindowNode extends WidgetNode<Gtk.Window, WindowProps, WindowChild> {
    protected override readonly excludedPropNames = OWN_PROPS;
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
        const WindowClass = containerClass;

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

    public override appendChild(child: WindowChild): void {
        if (child instanceof WindowNode) {
            child.container.setTransientFor(this.container);
            super.appendChild(child);
            return;
        }

        if (child instanceof DialogNode) {
            child.parentWindow = this.container;
            super.appendChild(child);
            return;
        }

        if (child instanceof MenuNode) {
            this.menu.appendChild(child);
        }
        super.appendChild(child);
    }

    public override removeChild(child: WindowChild): void {
        if (child instanceof WindowNode) {
            child.container.setTransientFor(null);
            super.removeChild(child);
            return;
        }

        if (child instanceof DialogNode) {
            child.parentWindow = null;
            super.removeChild(child);
            return;
        }

        if (child instanceof MenuNode) {
            this.menu.removeChild(child);
        }
        super.removeChild(child);
    }

    public override insertBefore(child: WindowChild, before: WindowChild): void {
        if (child instanceof MenuNode && before instanceof MenuNode) {
            this.menu.insertBefore(child, before);
        }
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
        super.commitUpdate(oldProps, newProps);
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
