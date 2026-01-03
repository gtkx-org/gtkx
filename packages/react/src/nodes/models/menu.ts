import { batch } from "@gtkx/ffi";
import * as Gio from "@gtkx/ffi/gio";
import type * as Gtk from "@gtkx/ffi/gtk";
import type { Node } from "../../node.js";
import { scheduleAfterCommit } from "../../scheduler.js";
import { signalStore } from "../internal/signal-store.js";
import { VirtualNode } from "../virtual.js";

export type MenuType = "root" | "item" | "section" | "submenu";

export type MenuProps = {
    id?: string;
    label?: string;
    accels?: string | string[];
    onActivate?: () => void;
};

export class Menu extends VirtualNode<MenuProps> {
    private actionMap?: Gio.ActionMap;
    private actionPrefix: string;
    private parent?: Gio.Menu;
    private menu: Gio.Menu;
    private type: MenuType;
    private application?: Gtk.Application;
    private action?: Gio.SimpleAction;
    private children: Menu[] = [];

    constructor(type: MenuType, props: MenuProps, actionMap?: Gio.ActionMap, application?: Gtk.Application) {
        super("", props, undefined);
        this.type = type;
        this.actionMap = actionMap;
        this.actionPrefix = application ? "app" : "menu";
        this.application = application;
        this.menu = new Gio.Menu();
    }

    public setActionMap(actionMap: Gio.ActionMap, prefix: string): void {
        this.actionMap = actionMap;
        this.actionPrefix = prefix;

        for (const child of this.children) {
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

    private getParent(): Gio.Menu {
        if (!this.parent) {
            throw new Error("Expected parent menu to be set on MenuNode");
        }

        return this.parent;
    }

    private getActionMap(): Gio.ActionMap {
        if (!this.actionMap) {
            throw new Error("Expected actionMap to be set on MenuNode");
        }

        return this.actionMap;
    }

    public createAction(): void {
        batch(() => {
            if (this.action) {
                signalStore.set(this, this.action, "activate", undefined);
            }

            this.action = new Gio.SimpleAction(this.getId());
            signalStore.set(this, this.action, "activate", this.getOnActivate());
            this.getActionMap().addAction(this.action);

            if (this.application && this.props.accels) {
                this.application.setAccelsForAction(this.getActionName(), this.getAccels());
            }
        });
    }

    private removeAction(): void {
        batch(() => {
            if (this.application && this.props.accels) {
                this.application.setAccelsForAction(this.getActionName(), []);
            }

            if (this.action) {
                this.getActionMap().removeAction(this.getId());
                signalStore.set(this, this.action, "activate", undefined);
                this.action = undefined;
            }
        });
    }

    private getPosition(): number {
        const parent = this.getParent();

        for (let i = 0; i < parent.getNItems(); i++) {
            if (this.type === "item") {
                const actionName = parent.getItemAttributeValue(i, "action")?.getString();

                if (actionName === this.getActionName()) {
                    return i;
                }
            } else {
                const link = parent.getItemLink(i, this.type);

                if (link?.equals(this.menu)) {
                    return i;
                }
            }
        }

        return 0;
    }

    private setParent(parent: Gio.Menu): void {
        this.parent = parent;
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

    public removeFromParent(): void {
        if (!this.parent) return;

        const position = this.getPosition();
        const parent = this.parent;
        this.parent = undefined;

        batch(() => parent.remove(position));
    }

    public insertInParentBefore(before: Menu): void {
        if (this.type === "item" && this.actionMap) {
            this.createAction();
        }

        scheduleAfterCommit(() => {
            const parent = this.getParent();
            const beforePosition = before.getPosition();

            switch (this.type) {
                case "item": {
                    parent.insert(beforePosition, this.props.label, this.getActionName());
                    break;
                }
                case "section":
                    parent.insertSection(beforePosition, this.menu, this.props.label);
                    break;
                case "submenu":
                    parent.insertSubmenu(beforePosition, this.menu, this.props.label);
                    break;
            }
        });
    }

    public appendToParent(): void {
        if (this.type === "item" && this.actionMap) {
            this.createAction();
        }

        scheduleAfterCommit(() => {
            const parent = this.getParent();

            switch (this.type) {
                case "item":
                    parent.append(this.props.label, this.getActionName());
                    break;
                case "section":
                    parent.appendSection(this.menu, this.props.label);
                    break;
                case "submenu":
                    parent.appendSubmenu(this.menu, this.props.label);
                    break;
            }
        });
    }

    public override appendChild(child: Node): void {
        if (!(child instanceof Menu)) {
            return;
        }

        this.children.push(child);

        if (this.actionMap) {
            child.setActionMap(this.actionMap, this.actionPrefix);
        }

        child.setParent(this.menu);
        child.appendToParent();
    }

    public override insertBefore(child: Node, before: Node): void {
        if (!(child instanceof Menu) || !(before instanceof Menu)) {
            return;
        }

        const beforeIndex = this.children.indexOf(before);

        if (beforeIndex >= 0) {
            this.children.splice(beforeIndex, 0, child);
        } else {
            this.children.push(child);
        }

        if (this.actionMap) {
            child.setActionMap(this.actionMap, this.actionPrefix);
        }

        child.setParent(this.menu);
        child.insertInParentBefore(before);
    }

    public override removeChild(child: Node): void {
        if (!(child instanceof Menu)) {
            return;
        }

        const index = this.children.indexOf(child);

        if (index >= 0) {
            this.children.splice(index, 1);
        }

        child.removeFromParent();
    }

    public override updateProps(oldProps: MenuProps | null, newProps: MenuProps): void {
        super.updateProps(oldProps, newProps);

        if (this.type === "item") {
            this.updateItemProps(oldProps, newProps);
        } else if (this.type === "section" || this.type === "submenu") {
            this.updateContainerProps(oldProps, newProps);
        }
    }

    private updateItemProps(oldProps: MenuProps | null, newProps: MenuProps): void {
        if (!this.parent || !this.actionMap) {
            return;
        }

        if (!oldProps) {
            return;
        }

        if (oldProps.id !== newProps.id || oldProps.label !== newProps.label) {
            const parent = this.parent;
            this.removeAction();
            this.removeFromParent();
            this.parent = parent;
            this.createAction();
            this.appendToParent();
            return;
        }

        if (oldProps.onActivate !== newProps.onActivate) {
            signalStore.set(this, this.getAction(), "activate", newProps.onActivate);
        }

        if (oldProps.accels !== newProps.accels) {
            if (this.application) {
                this.application.setAccelsForAction(this.getActionName(), this.getAccels());
            }
        }
    }

    private updateContainerProps(oldProps: MenuProps | null, newProps: MenuProps): void {
        if (!this.parent) {
            return;
        }

        if (!oldProps || oldProps.label !== newProps.label) {
            const position = this.getPosition();
            const parent = this.parent;

            this.removeFromParent();

            if (this.type === "section") {
                parent.insertSection(position, this.menu, newProps.label);
            } else if (this.type === "submenu") {
                parent.insertSubmenu(position, this.menu, newProps.label);
            }
        }
    }

    public override unmount(): void {
        this.removeAction();

        if (this.parent) {
            this.removeFromParent();
            this.parent = undefined;
        }

        super.unmount();
    }
}
