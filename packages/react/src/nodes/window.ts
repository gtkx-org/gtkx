import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import type { GtkAboutDialogProps, GtkWindowProps } from "../jsx.js";
import type { Node } from "../node.js";
import type { BackingInstance, Props } from "../types.js";
import { AnimationNode } from "./animation.js";
import { ContainerSlotNode } from "./container-slot.js";
import type { DialogNode } from "./dialog.js";
import { EventControllerNode } from "./event-controller.js";
import { type PropDescriptorTable, signal } from "./internal/apply-props.js";
import { MenuChildController } from "./internal/menu-child.js";
import { MenuNode } from "./menu.js";
import { MenuModel } from "./models/menu.js";
import { NavigationPageNode } from "./navigation-page.js";
import { SizeGroupNode } from "./size-group.js";
import { SlotNode } from "./slot.js";
import { WidgetNode } from "./widget.js";

// biome-ignore lint/suspicious/noExplicitAny: Required for matching GTK class constructors with varying signatures
const isOrExtendsClass = (target: object, cls: abstract new (...args: any[]) => any): boolean =>
    target === cls || Object.prototype.isPrototypeOf.call(cls, target);

type WindowProps = Pick<GtkWindowProps, "onClose"> & Pick<GtkAboutDialogProps, "creditSections">;

type WindowChild =
    | WindowNode
    | DialogNode
    | MenuNode
    | SlotNode
    | ContainerSlotNode
    | AnimationNode
    | NavigationPageNode
    | EventControllerNode
    | SizeGroupNode
    | WidgetNode;

export class WindowNode extends WidgetNode<Gtk.Window, WindowProps, WindowChild> {
    private readonly menuController: MenuChildController;

    public static override createContainer(
        typeName: string,
        props: Props,
        containerClass: typeof Gtk.Window,
        rootContainer: BackingInstance | undefined,
    ): Gtk.Window {
        const WindowClass = containerClass;

        if (
            isOrExtendsClass(WindowClass, Gtk.ApplicationWindow) ||
            isOrExtendsClass(WindowClass, Adw.ApplicationWindow)
        ) {
            if (!(rootContainer instanceof Gtk.Application)) {
                throw new TypeError("Expected ApplicationWindow to be created within Application");
            }

            if (isOrExtendsClass(WindowClass, Adw.ApplicationWindow)) {
                return new Adw.ApplicationWindow({ application: rootContainer });
            }

            return new Gtk.ApplicationWindow({ application: rootContainer });
        }

        return WidgetNode.createContainer(typeName, props, containerClass) as Gtk.Window;
    }

    constructor(typeName: string, props: WindowProps, container: Gtk.Window, rootContainer: BackingInstance) {
        super(typeName, props, container, rootContainer);
        const application = rootContainer instanceof Gtk.Application ? rootContainer : undefined;
        const actionMap = container instanceof Gtk.ApplicationWindow ? container : undefined;
        this.menuController = new MenuChildController(
            new MenuModel({ type: "root", props: {}, rootContainer, actionMap, application }),
        );

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
            child instanceof NavigationPageNode ||
            child instanceof EventControllerNode ||
            child instanceof ContainerSlotNode ||
            child instanceof SizeGroupNode
        );
    }

    public override appendChild(child: WindowChild): void {
        if (child instanceof WindowNode) {
            child.backingInstance.setTransientFor(this.backingInstance);
            super.appendChild(child);
            return;
        }

        if (this.menuController.appendChild(child)) return;

        super.appendChild(child);
    }

    public override removeChild(child: WindowChild): void {
        if (child instanceof WindowNode) {
            child.backingInstance.setVisible(false);
            child.backingInstance.setTransientFor(null);
            super.removeChild(child);
            return;
        }

        if (this.menuController.removeChild(child)) return;

        super.removeChild(child);
    }

    public override insertBefore(child: WindowChild, before: WindowChild): void {
        if (child instanceof WindowNode) {
            child.backingInstance.setTransientFor(this.backingInstance);
            super.insertBefore(child, before);
            return;
        }

        if (this.menuController.insertBefore(child, before)) return;

        super.insertBefore(child, before);
    }

    public override finalizeInitialChildren(props: WindowProps): boolean {
        this.commitUpdate(null, props);
        return true;
    }

    protected override ownPropDescriptors(): PropDescriptorTable {
        return {
            ...super.ownPropDescriptors(),
            onClose: signal("close-request", { getArgs: () => [], returnValue: true }),
        };
    }

    public override commitMount(): void {
        this.backingInstance.present();
    }

    public override detachDeletedInstance(): void {
        super.detachDeletedInstance();
        this.backingInstance.destroy();
    }
}
