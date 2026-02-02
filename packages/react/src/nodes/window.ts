import * as Adw from "@gtkx/ffi/adw";
import * as Gtk from "@gtkx/ffi/gtk";
import type { GtkAboutDialogProps, GtkWindowProps } from "../jsx.js";
import type { Node } from "../node.js";
import type { Container, Props } from "../types.js";
import { AnimationNode } from "./animation.js";
import type { DialogNode } from "./dialog.js";
import { filterProps, hasChanged } from "./internal/props.js";
import { MenuNode } from "./menu.js";
import { MenuModel } from "./models/menu.js";
import { NavigationPageNode } from "./navigation-page.js";
import { SlotNode } from "./slot.js";
import { WidgetNode } from "./widget.js";

// biome-ignore lint/suspicious/noExplicitAny: Required for matching GTK class constructors with varying signatures
const isOrExtendsClass = (target: object, cls: abstract new (...args: any[]) => any): boolean =>
    target === cls || Object.prototype.isPrototypeOf.call(cls, target);

const OWN_PROPS = ["onClose"] as const;

export type WindowProps = Pick<GtkWindowProps, "onClose"> & Pick<GtkAboutDialogProps, "creditSections">;

type WindowChild = WindowNode | DialogNode | MenuNode | SlotNode | AnimationNode | NavigationPageNode | WidgetNode;

export class WindowNode extends WidgetNode<Gtk.Window, WindowProps, WindowChild> {
    private menu: MenuModel;

    public static override createContainer(
        props: Props,
        containerClass: typeof Gtk.Window,
        rootContainer: Container | undefined,
    ): Gtk.Window {
        const WindowClass = containerClass;

        if (
            isOrExtendsClass(WindowClass, Gtk.ApplicationWindow) ||
            isOrExtendsClass(WindowClass, Adw.ApplicationWindow)
        ) {
            if (!(rootContainer instanceof Gtk.Application)) {
                throw new Error("Expected ApplicationWindow to be created within Application");
            }

            if (isOrExtendsClass(WindowClass, Adw.ApplicationWindow)) {
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

    protected override shouldAttachToParent(): boolean {
        return false;
    }

    public override isValidChild(child: Node): boolean {
        return (
            child instanceof WidgetNode ||
            child instanceof MenuNode ||
            child instanceof SlotNode ||
            child instanceof AnimationNode ||
            child instanceof NavigationPageNode
        );
    }

    public override appendChild(child: WindowChild): void {
        if (child instanceof WindowNode) {
            child.container.setTransientFor(this.container);
            super.appendChild(child);
            return;
        }

        if (child instanceof MenuNode) {
            this.menu.appendChild(child);
            return;
        }

        super.appendChild(child);
    }

    public override removeChild(child: WindowChild): void {
        if (child instanceof WindowNode) {
            child.container.setTransientFor(null);
            super.removeChild(child);
            return;
        }

        if (child instanceof MenuNode) {
            this.menu.removeChild(child);
            return;
        }

        super.removeChild(child);
    }

    public override insertBefore(child: WindowChild, before: WindowChild): void {
        if (child instanceof MenuNode) {
            if (before instanceof MenuNode) {
                this.menu.insertBefore(child, before);
            } else {
                this.menu.appendChild(child);
            }
            return;
        }

        if (child instanceof WindowNode) {
            child.container.setTransientFor(this.container);
        }

        super.insertBefore(child, before);
    }

    public override finalizeInitialChildren(props: WindowProps): boolean {
        this.commitUpdate(null, props);
        return true;
    }

    public override commitUpdate(oldProps: WindowProps | null, newProps: WindowProps): void {
        super.commitUpdate(oldProps ? filterProps(oldProps, OWN_PROPS) : null, filterProps(newProps, OWN_PROPS));
        this.applyOwnProps(oldProps, newProps);
    }

    public override commitMount(): void {
        this.container.present();
    }

    public override detachDeletedInstance(): void {
        this.container.destroy();
        super.detachDeletedInstance();
    }

    private applyOwnProps(oldProps: WindowProps | null, newProps: WindowProps): void {
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
