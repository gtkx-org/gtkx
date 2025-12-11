import { getCurrentApp, getInterface } from "@gtkx/ffi";
import * as Gio from "@gtkx/ffi/gio";
import * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import type { Props } from "../factory.js";
import { Node } from "../node.js";
import { RootNode } from "./root.js";

let actionCounter = 0;
const generateActionName = () => `gtkx_menu_action_${actionCounter++}`;

interface MenuEntry {
    type: "item" | "section" | "submenu";
    label?: string;
    action?: string;
    menu?: Gio.Menu;
}

interface MenuContainer {
    getMenu(): Gio.Menu;
    addMenuEntry(entry: MenuEntry): void;
    removeMenuEntry(entry: MenuEntry): void;
}

const isMenuContainer = (node: Node): node is Node & MenuContainer =>
    "getMenu" in node && "addMenuEntry" in node && "removeMenuEntry" in node;

abstract class MenuContainerNode<T extends Gtk.Widget | undefined> extends Node<T> implements MenuContainer {
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
                this.menu.append(entry.label ?? null, entry.action ?? null);
            } else if (entry.type === "section" && entry.menu) {
                this.menu.appendSection(entry.menu, entry.label ?? null);
            } else if (entry.type === "submenu" && entry.menu) {
                this.menu.appendSubmenu(entry.menu, entry.label ?? null);
            }
        }

        this.onMenuRebuilt();
    }

    protected onMenuRebuilt(): void {}
}

export class PopoverMenuRootNode extends MenuContainerNode<Gtk.PopoverMenu> {
    static matches(type: string): boolean {
        return type === "PopoverMenu.Root";
    }

    override initialize(props: Props): void {
        this.widget = new Gtk.PopoverMenu(this.menu);
        super.initialize(props);
    }

    protected override onMenuRebuilt(): void {
        this.widget.setMenuModel(this.menu);
    }
}

export class PopoverMenuBarNode extends MenuContainerNode<Gtk.PopoverMenuBar> {
    static matches(type: string): boolean {
        return type === "PopoverMenuBar";
    }

    override initialize(props: Props): void {
        this.widget = new Gtk.PopoverMenuBar(this.menu);
        super.initialize(props);
    }

    protected override onMenuRebuilt(): void {
        this.widget.setMenuModel(this.menu);
    }
}

export class ApplicationMenuNode extends MenuContainerNode<never> {
    static matches(type: string): boolean {
        return type === "ApplicationMenu";
    }

    protected override isVirtual(): boolean {
        return true;
    }

    override detachFromParent(_parent: Node): void {
        getCurrentApp().setMenubar(null);
    }

    override attachToParent(parent: Node): void {
        if (!(parent instanceof RootNode)) {
            throw new Error("ApplicationMenu must be a direct child of a fragment at the root level");
        }
    }

    override mount(): void {
        getCurrentApp().setMenubar(this.menu);
    }

    protected override onMenuRebuilt(): void {
        getCurrentApp().setMenubar(this.menu);
    }
}

export class MenuItemNode extends Node<never> {
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
    private isAttached = false;

    override initialize(props: Props): void {
        this.onActivateCallback = props.onActivate as (() => void) | undefined;
        this.currentAccels = props.accels as string | string[] | undefined;
        this.entry.label = props.label as string | undefined;
        super.initialize(props);
    }

    override attachToParent(parent: Node): void {
        if (!isMenuContainer(parent)) return;
        this.isAttached = true;
        this.setupAction();
        parent.addMenuEntry(this.entry);
    }

    override detachFromParent(parent: Node): void {
        if (!isMenuContainer(parent)) return;
        parent.removeMenuEntry(this.entry);
        this.cleanupAction();
        this.isAttached = false;
    }

    protected override consumedProps(): Set<string> {
        const consumed = super.consumedProps();
        consumed.add("label");
        consumed.add("onActivate");
        consumed.add("accels");
        return consumed;
    }

    override updateProps(oldProps: Props, newProps: Props): void {
        // If entry doesn't exist yet, fields aren't initialized
        // This happens when base class constructor calls updateProps
        // before derived class field initializers run - skip in that case
        if (!this.entry) {
            super.updateProps(oldProps, newProps);
            return;
        }

        const labelChanged = oldProps.label !== newProps.label;
        const hadCallback = oldProps.onActivate !== undefined;
        const hasCallback = newProps.onActivate !== undefined;
        const accelsChanged = oldProps.accels !== newProps.accels;

        // Always update the callback reference - the signal handler uses this
        this.onActivateCallback = newProps.onActivate as (() => void) | undefined;
        this.currentAccels = newProps.accels as string | string[] | undefined;

        if (labelChanged) {
            this.entry.label = newProps.label as string | undefined;
        }

        // Only cleanup/setup action if the presence of a callback changed
        // (not when the callback reference changes - we store the ref and call it)
        if (this.isAttached && hadCallback !== hasCallback) {
            this.cleanupAction();
            this.setupAction();
        }

        if (accelsChanged && this.actionName) {
            this.updateAccels(this.currentAccels);
        }

        super.updateProps(oldProps, newProps);
    }

    private setupAction(): void {
        if (!this.onActivateCallback) return;

        this.actionName = generateActionName();
        this.action = new Gio.SimpleAction(this.actionName);
        this.signalHandlerId = this.action.connect("activate", () => {
            // Call the current callback (may have been updated via updateProps)
            this.onActivateCallback?.();
        });

        const app = getCurrentApp();
        const action = getInterface(this.action, Gio.Action);

        if (!action) {
            throw new Error("Failed to get Gio.Action interface from SimpleAction");
        }

        app.addAction(action);

        this.entry.action = `app.${this.actionName}`;

        if (this.currentAccels) {
            this.updateAccels(this.currentAccels);
        }
    }

    private cleanupAction(): void {
        if (this.actionName) {
            const app = getCurrentApp();
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

        const app = getCurrentApp();
        const accelArray = accels ? (Array.isArray(accels) ? accels : [accels]) : [];
        app.setAccelsForAction(`app.${this.actionName}`, accelArray);
    }
}

export class MenuSectionNode extends MenuContainerNode<never> {
    static matches(type: string): boolean {
        return type === "Menu.Section";
    }

    protected override isVirtual(): boolean {
        return true;
    }

    private entry: MenuEntry = { type: "section" };

    override initialize(props: Props): void {
        this.entry.menu = this.menu;
        this.entry.label = props.label as string | undefined;
        super.initialize(props);
    }

    override attachToParent(parent: Node): void {
        if (!isMenuContainer(parent)) return;
        parent.addMenuEntry(this.entry);
    }

    override detachFromParent(parent: Node): void {
        if (!isMenuContainer(parent)) return;
        parent.removeMenuEntry(this.entry);
    }

    protected override consumedProps(): Set<string> {
        const consumed = super.consumedProps();
        consumed.add("label");
        return consumed;
    }

    override updateProps(oldProps: Props, newProps: Props): void {
        if (oldProps.label !== newProps.label && this.entry) {
            this.entry.label = newProps.label as string | undefined;
        }

        super.updateProps(oldProps, newProps);
    }
}

export class MenuSubmenuNode extends MenuContainerNode<never> {
    static matches(type: string): boolean {
        return type === "Menu.Submenu";
    }

    protected override isVirtual(): boolean {
        return true;
    }

    private entry: MenuEntry = { type: "submenu" };

    override initialize(props: Props): void {
        this.entry.menu = this.menu;
        this.entry.label = props.label as string | undefined;
        super.initialize(props);
    }

    override attachToParent(parent: Node): void {
        if (!isMenuContainer(parent)) return;
        parent.addMenuEntry(this.entry);
    }

    override detachFromParent(parent: Node): void {
        if (!isMenuContainer(parent)) return;
        parent.removeMenuEntry(this.entry);
    }

    protected override consumedProps(): Set<string> {
        const consumed = super.consumedProps();
        consumed.add("label");
        return consumed;
    }

    override updateProps(oldProps: Props, newProps: Props): void {
        if (oldProps.label !== newProps.label && this.entry) {
            this.entry.label = newProps.label as string | undefined;
        }

        super.updateProps(oldProps, newProps);
    }
}
