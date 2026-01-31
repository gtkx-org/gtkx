import * as Gio from "@gtkx/ffi/gio";
import type * as Gtk from "@gtkx/ffi/gtk";
import type { Node } from "../../node.js";
import type { Container } from "../../types.js";
import { VirtualNode } from "../virtual.js";

export type MenuType = "root" | "item" | "section" | "submenu";

export type MenuProps = {
    id?: string;
    label?: string;
    accels?: string | string[];
    onActivate?: () => void;
};

export class MenuModel extends VirtualNode<MenuProps, Node, MenuModel> {
    private actionMap: Gio.ActionMap | null = null;
    private actionPrefix: string;
    private parentMenu: Gio.Menu | null = null;
    private menu: Gio.Menu;
    private type: MenuType;
    private application: Gtk.Application | null = null;
    private action: Gio.SimpleAction | null = null;
    private menuChildren: MenuModel[] = [];

    constructor(
        type: MenuType,
        props: MenuProps,
        rootContainer: Container,
        actionMap?: Gio.ActionMap,
        application?: Gtk.Application,
    ) {
        super("", props, undefined, rootContainer);
        this.type = type;
        this.actionMap = actionMap ?? null;
        this.actionPrefix = application ? "app" : "menu";
        this.application = application ?? null;
        this.menu = new Gio.Menu();
    }

    public setActionMap(actionMap: Gio.ActionMap, prefix: string): void {
        this.actionMap = actionMap;
        this.actionPrefix = prefix;

        for (const child of this.menuChildren) {
            child.setActionMap(actionMap, prefix);

            if (child.type === "item") {
                child.createAction();
            }
        }
    }

    private getAccels(): string[] {
        const accels = this.props.accels;

        if (!accels) {
            return [];
        }

        return Array.isArray(accels) ? accels : [accels];
    }

    private getActionName(): string {
        return `${this.actionPrefix}.${this.props.id}`;
    }

    private getOnActivate(): () => void {
        if (!this.props.onActivate) {
            throw new Error("Expected 'onActivate' prop to be present on MenuItem");
        }

        return this.props.onActivate;
    }

    private getId(): string {
        if (!this.props.id) {
            throw new Error("Expected 'id' prop to be present on MenuItem");
        }

        return this.props.id;
    }

    private getParentMenu(): Gio.Menu {
        if (!this.parentMenu) {
            throw new Error("Expected parent menu to be set on MenuNode");
        }

        return this.parentMenu;
    }

    private getActionMap(): Gio.ActionMap {
        if (!this.actionMap) {
            throw new Error("Expected actionMap to be set on MenuNode");
        }

        return this.actionMap;
    }

    public createAction(): void {
        if (this.action) {
            this.signalStore.set(this, this.action, "activate", null);
        }

        this.action = new Gio.SimpleAction(this.getId());
        this.signalStore.set(this, this.action, "activate", this.getOnActivate());
        this.getActionMap().addAction(this.action);

        if (this.application && this.props.accels) {
            this.application.setAccelsForAction(this.getActionName(), this.getAccels());
        }
    }

    private removeAction(): void {
        if (this.application && this.props.accels) {
            this.application.setAccelsForAction(this.getActionName(), []);
        }

        if (this.action) {
            this.getActionMap().removeAction(this.getId());
            this.signalStore.set(this, this.action, "activate", null);
            this.action = null;
        }
    }

    private getPosition(): number {
        return this.findPositionIn(this.getParentMenu());
    }

    private findPositionIn(parentMenu: Gio.Menu): number {
        for (let i = 0; i < parentMenu.getNItems(); i++) {
            if (this.type === "item") {
                const actionName = parentMenu.getItemAttributeValue(i, "action")?.getString();

                if (actionName === this.getActionName()) {
                    return i;
                }
            } else {
                const link = parentMenu.getItemLink(i, this.type);

                if (link && link === this.menu) {
                    return i;
                }
            }
        }

        return -1;
    }

    private setParentMenu(parentMenu: Gio.Menu): void {
        this.parentMenu = parentMenu;
    }

    public getMenu(): Gio.Menu {
        return this.menu;
    }

    private getAction(): Gio.SimpleAction {
        if (!this.action) {
            throw new Error("Expected action to be created on MenuItem");
        }

        return this.action;
    }

    public removeFromParentMenu(): void {
        if (!this.parentMenu) return;

        const parentMenu = this.parentMenu;
        this.parentMenu = null;

        const position = this.findPositionIn(parentMenu);

        if (position >= 0) {
            parentMenu.remove(position);
        }
    }

    public insertInParentBefore(before: MenuModel): void {
        if (this.type === "item" && this.actionMap) {
            this.createAction();
        }

        const parentMenu = this.getParentMenu();
        const beforePosition = before.getPosition();

        switch (this.type) {
            case "item": {
                parentMenu.insert(beforePosition, this.props.label, this.getActionName());
                break;
            }
            case "section":
                parentMenu.insertSection(beforePosition, this.menu, this.props.label);
                break;
            case "submenu":
                parentMenu.insertSubmenu(beforePosition, this.menu, this.props.label);
                break;
        }
    }

    public appendToParentMenu(): void {
        if (this.type === "item" && this.actionMap) {
            this.createAction();
        }

        const parentMenu = this.getParentMenu();

        switch (this.type) {
            case "item":
                parentMenu.append(this.props.label, this.getActionName());
                break;
            case "section":
                parentMenu.appendSection(this.menu, this.props.label);
                break;
            case "submenu":
                parentMenu.appendSubmenu(this.menu, this.props.label);
                break;
        }
    }

    public override appendChild(child: MenuModel): void {
        this.menuChildren.push(child);

        if (this.actionMap) {
            child.setActionMap(this.actionMap, this.actionPrefix);
        }

        child.setParentMenu(this.menu);
        child.appendToParentMenu();
    }

    public override insertBefore(child: MenuModel, before: MenuModel): void {
        const beforeIndex = this.menuChildren.indexOf(before);

        if (beforeIndex >= 0) {
            this.menuChildren.splice(beforeIndex, 0, child);
        } else {
            this.menuChildren.push(child);
        }

        if (this.actionMap) {
            child.setActionMap(this.actionMap, this.actionPrefix);
        }

        child.setParentMenu(this.menu);
        child.insertInParentBefore(before);
    }

    public override removeChild(child: MenuModel): void {
        const index = this.menuChildren.indexOf(child);

        if (index >= 0) {
            this.menuChildren.splice(index, 1);
        }

        child.removeFromParentMenu();
    }

    public override commitUpdate(oldProps: MenuProps | null, newProps: MenuProps): void {
        super.commitUpdate(oldProps, newProps);

        if (this.type === "item") {
            this.updateItemProps(oldProps, newProps);
        } else if (this.type === "section" || this.type === "submenu") {
            this.updateContainerProps(oldProps, newProps);
        }
    }

    private updateItemProps(oldProps: MenuProps | null, newProps: MenuProps): void {
        if (!this.parentMenu || !this.actionMap) {
            return;
        }

        if (!oldProps) {
            return;
        }

        if (oldProps.id !== newProps.id || oldProps.label !== newProps.label) {
            const parentMenu = this.parentMenu;
            this.removeAction();
            this.removeFromParentMenu();
            this.parentMenu = parentMenu;
            this.createAction();
            this.appendToParentMenu();
            return;
        }

        if (oldProps.onActivate !== newProps.onActivate) {
            this.signalStore.set(this, this.getAction(), "activate", newProps.onActivate);
        }

        if (oldProps.accels !== newProps.accels) {
            if (this.application) {
                this.application.setAccelsForAction(this.getActionName(), this.getAccels());
            }
        }
    }

    private updateContainerProps(oldProps: MenuProps | null, newProps: MenuProps): void {
        if (!this.parentMenu) {
            return;
        }

        if (!oldProps || oldProps.label !== newProps.label) {
            const parentMenu = this.parentMenu;
            const position = this.findPositionIn(parentMenu);

            if (position >= 0) {
                parentMenu.remove(position);

                if (this.type === "section") {
                    parentMenu.insertSection(position, this.menu, this.props.label);
                } else if (this.type === "submenu") {
                    parentMenu.insertSubmenu(position, this.menu, this.props.label);
                }
            }
        }
    }

    public override detachDeletedInstance(): void {
        this.removeAction();
        this.removeFromParentMenu();
        super.detachDeletedInstance();
    }
}
