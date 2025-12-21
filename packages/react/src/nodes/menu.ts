import { getApplication } from "@gtkx/ffi";
import * as Gio from "@gtkx/ffi/gio";
import * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import type { Props } from "../factory.js";
import type { Node } from "../node.js";
import { Node as NodeClass } from "../node.js";
import { RootNode } from "./root.js";

let actionCounter = 0;
const generateActionName = () => `gtkx_menu_action_${actionCounter++}`;

type MenuEntry = {
    type: "item" | "section" | "submenu";
    label?: string;
    action?: string;
    menu?: Gio.Menu;
};

interface MenuContainer {
    getMenu(): Gio.Menu;
    addMenuEntry(entry: MenuEntry): void;
    removeMenuEntry(entry: MenuEntry): void;
}

interface MenuEntryNode {
    parent: Node | null;
    getMenuEntry(): MenuEntry;
    setParentContainer(container: Node & MenuContainer): void;
    onAttach(): void;
    onDetach(): void;
    unmount(): void;
}

const isMenuEntryNode = (node: Node): node is Node & MenuEntryNode =>
    "getMenuEntry" in node && "setParentContainer" in node;

abstract class MenuContainerNode<T extends Gtk.Widget | undefined> extends NodeClass<T> implements MenuContainer {
    protected menu: Gio.Menu = new Gio.Menu();
    protected entries: MenuEntry[] = [];
    private rebuildScheduled = false;

    getMenu(): Gio.Menu {
        return this.menu;
    }

    addMenuEntry(entry: MenuEntry): void {
        this.entries.push(entry);
        this.scheduleRebuild();
    }

    removeMenuEntry(entry: MenuEntry): void {
        const index = this.entries.indexOf(entry);
        if (index !== -1) {
            this.entries.splice(index, 1);
            this.scheduleRebuild();
        }
    }

    override appendChild(child: Node): void {
        if (isMenuEntryNode(child)) {
            child.parent = this;
            child.onAttach();
            this.addMenuEntry(child.getMenuEntry());
            child.setParentContainer(this);
            return;
        }
        super.appendChild(child);
    }

    override insertBefore(child: Node, before: Node): void {
        if (isMenuEntryNode(child)) {
            child.parent = this;
            child.onAttach();
            this.addMenuEntry(child.getMenuEntry());
            child.setParentContainer(this);
            return;
        }
        super.insertBefore(child, before);
    }

    override removeChild(child: Node): void {
        if (isMenuEntryNode(child)) {
            this.removeMenuEntry(child.getMenuEntry());
            child.unmount();
            child.parent = null;
            return;
        }
        super.removeChild(child);
    }

    private scheduleRebuild(): void {
        if (this.rebuildScheduled) return;
        this.rebuildScheduled = true;
        queueMicrotask(() => {
            this.rebuildScheduled = false;
            this.rebuildMenu();
        });
    }

    protected rebuildMenu(): void {
        this.menu.removeAll();

        for (const entry of this.entries) {
            if (entry.type === "item") {
                this.menu.append(entry.label, entry.action);
            } else if (entry.type === "section" && entry.menu) {
                this.menu.appendSection(entry.menu, entry.label);
            } else if (entry.type === "submenu" && entry.menu) {
                this.menu.appendSubmenu(entry.menu, entry.label);
            }
        }

        this.onMenuRebuilt();
    }

    protected onMenuRebuilt(): void {}
}

type MenuWidget = Gtk.Widget & {
    setMenuModel(model?: Gio.MenuModel): void;
};

abstract class MenuWidgetNode<T extends MenuWidget> extends MenuContainerNode<T> {
    protected abstract createMenuWidget(menu: Gio.Menu): T;

    override initialize(props: Props): void {
        this.widget = this.createMenuWidget(this.menu);
        super.initialize(props);
    }

    protected override onMenuRebuilt(): void {
        this.widget.setMenuModel(this.menu);
    }
}

export class PopoverMenuRootNode extends MenuWidgetNode<Gtk.PopoverMenu> {
    static matches(type: string): boolean {
        return type === "GtkPopoverMenu.Root";
    }

    protected createMenuWidget(menu: Gio.Menu): Gtk.PopoverMenu {
        return new Gtk.PopoverMenu(menu);
    }
}

export class PopoverMenuBarNode extends MenuWidgetNode<Gtk.PopoverMenuBar> {
    static matches(type: string): boolean {
        return type === "GtkPopoverMenuBar";
    }

    protected createMenuWidget(menu: Gio.Menu): Gtk.PopoverMenuBar {
        return new Gtk.PopoverMenuBar(menu);
    }
}

export class ApplicationMenuNode extends MenuContainerNode<never> {
    static matches(type: string): boolean {
        return type === "ApplicationMenu";
    }

    protected override isVirtual(): boolean {
        return true;
    }

    override mount(): void {
        if (!(this.parent instanceof RootNode)) {
            throw new Error("ApplicationMenu must be a direct child of a fragment at the root level");
        }
        getApplication().setMenubar(this.menu);
    }

    override unmount(): void {
        getApplication().setMenubar(undefined);
        super.unmount();
    }

    protected override onMenuRebuilt(): void {
        getApplication().setMenubar(this.menu);
    }
}

export class MenuItemNode extends NodeClass<never> implements MenuEntryNode {
    static override consumedPropNames = ["label", "onActivate", "accels"];

    static matches(type: string): boolean {
        return type === "Menu.Item";
    }

    protected override isVirtual(): boolean {
        return true;
    }

    private entry: MenuEntry = { type: "item" };
    private action: Gio.SimpleAction | null = null;
    private actionName: string | null = null;
    private signalHandlerId: number | null = null;
    private onActivateCallback: (() => void) | undefined;
    private currentAccels: string | string[] | undefined;
    private parentContainer: (Node & MenuContainer) | null = null;

    override initialize(props: Props): void {
        this.onActivateCallback = props.onActivate as (() => void) | undefined;
        this.currentAccels = props.accels as string | string[] | undefined;
        this.entry.label = props.label as string | undefined;
        super.initialize(props);
    }

    getMenuEntry(): MenuEntry {
        return this.entry;
    }

    setParentContainer(container: Node & MenuContainer): void {
        this.parentContainer = container;
    }

    onAttach(): void {
        this.setupAction();
    }

    onDetach(): void {
        this.cleanupAction();
    }

    override unmount(): void {
        this.cleanupAction();
        this.parentContainer = null;
        super.unmount();
    }

    private isFieldInitializationIncomplete(): boolean {
        return !this.entry;
    }

    override updateProps(oldProps: Props, newProps: Props): void {
        if (this.isFieldInitializationIncomplete()) {
            super.updateProps(oldProps, newProps);
            return;
        }

        const labelChanged = oldProps.label !== newProps.label;
        const callbackPresenceChanged = (oldProps.onActivate !== undefined) !== (newProps.onActivate !== undefined);
        const accelsChanged = oldProps.accels !== newProps.accels;

        this.onActivateCallback = newProps.onActivate as (() => void) | undefined;
        this.currentAccels = newProps.accels as string | string[] | undefined;

        if (labelChanged) {
            this.entry.label = newProps.label as string | undefined;
        }

        if (this.parentContainer && callbackPresenceChanged) {
            this.cleanupAction();
            this.setupAction();
        }

        if (accelsChanged && this.actionName) {
            this.updateAccels(this.currentAccels);
        }

        super.updateProps(oldProps, newProps);
    }

    private invokeCurrentCallback(): void {
        this.onActivateCallback?.();
    }

    private setupAction(): void {
        if (!this.onActivateCallback) return;

        this.actionName = generateActionName();
        this.action = new Gio.SimpleAction(this.actionName);
        this.signalHandlerId = this.action.connect("activate", () => this.invokeCurrentCallback());

        const app = getApplication();

        app.addAction(this.action);

        this.entry.action = `app.${this.actionName}`;

        if (this.currentAccels) {
            this.updateAccels(this.currentAccels);
        }
    }

    private cleanupAction(): void {
        if (this.actionName) {
            const app = getApplication();
            app.removeAction(this.actionName);

            if (this.currentAccels) {
                app.setAccelsForAction(`app.${this.actionName}`, []);
            }
        }

        if (this.action && this.signalHandlerId !== null) {
            GObject.signalHandlerDisconnect(this.action, this.signalHandlerId);
        }

        this.action = null;
        this.actionName = null;
        this.signalHandlerId = null;
        this.entry.action = undefined;
    }

    private updateAccels(accels: string | string[] | undefined): void {
        if (!this.actionName) return;

        const app = getApplication();
        const accelArray = accels ? (Array.isArray(accels) ? accels : [accels]) : [];
        app.setAccelsForAction(`app.${this.actionName}`, accelArray);
    }
}

class MenuContainerItemNode extends MenuContainerNode<never> implements MenuEntryNode {
    static override consumedPropNames = ["label"];

    protected entryType: "section" | "submenu" = "section";
    protected matchType = "";

    static matches(_type: string): boolean {
        return false;
    }

    protected override isVirtual(): boolean {
        return true;
    }

    private entry: MenuEntry = { type: "section" };

    override initialize(props: Props): void {
        this.entry = { type: this.entryType };
        this.entry.menu = this.menu;
        this.entry.label = props.label as string | undefined;
        super.initialize(props);
    }

    getMenuEntry(): MenuEntry {
        return this.entry;
    }

    setParentContainer(_container: Node & MenuContainer): void {}

    onAttach(): void {}

    onDetach(): void {}

    override updateProps(oldProps: Props, newProps: Props): void {
        if (oldProps.label !== newProps.label && this.entry) {
            this.entry.label = newProps.label as string | undefined;
        }

        super.updateProps(oldProps, newProps);
    }
}

export class MenuSectionNode extends MenuContainerItemNode {
    protected override entryType: "section" | "submenu" = "section";

    static override matches(type: string): boolean {
        return type === "Menu.Section";
    }
}

export class MenuSubmenuNode extends MenuContainerItemNode {
    protected override entryType: "section" | "submenu" = "submenu";

    static override matches(type: string): boolean {
        return type === "Menu.Submenu";
    }
}
