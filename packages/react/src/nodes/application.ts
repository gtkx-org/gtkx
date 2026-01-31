import * as Gtk from "@gtkx/ffi/gtk";
import { Node } from "../node.js";
import { CommitPriority, scheduleAfterCommit } from "../scheduler.js";
import type { Container, Props } from "../types.js";
import { DialogNode } from "./dialog.js";
import { MenuNode } from "./menu.js";
import { MenuModel } from "./models/menu.js";
import { WindowNode } from "./window.js";

export class ApplicationNode extends Node<Gtk.Application> {
    private menu: MenuModel;

    constructor(typeName: string, props: Props, container: Gtk.Application, rootContainer: Container) {
        super(typeName, props, container, rootContainer);
        const application = rootContainer instanceof Gtk.Application ? rootContainer : undefined;
        this.menu = new MenuModel("root", {}, rootContainer, container, application);
    }

    public override appendChild(child: Node): void {
        if (child instanceof MenuNode) {
            this.menu.appendChild(child);
            this.container.setMenubar(this.menu.getMenu());
            return;
        }

        if (child instanceof WindowNode && child.container instanceof Gtk.ApplicationWindow) {
            return;
        }

        if (child instanceof DialogNode) {
            return;
        }

        throw new Error(
            `Cannot append '${child.typeName}' to 'Application': expected ApplicationWindow, Dialog, or MenuItem`,
        );
    }

    public override insertBefore(child: Node, before: Node): void {
        if (child instanceof MenuNode) {
            this.menu.insertBefore(child, before);
            return;
        }

        if (child instanceof WindowNode && child.container instanceof Gtk.ApplicationWindow) {
            return;
        }

        if (child instanceof DialogNode) {
            return;
        }

        throw new Error(
            `Cannot insert '${child.typeName}' into 'Application': expected ApplicationWindow, Dialog, or MenuItem`,
        );
    }

    public override removeChild(child: Node): void {
        if (child instanceof MenuNode) {
            this.menu.removeChild(child);

            scheduleAfterCommit(() => {
                if (this.menu.getMenu().getNItems() === 0) {
                    this.container.setMenubar(null);
                }
            }, CommitPriority.LOW);
            return;
        }

        if (child instanceof WindowNode && child.container instanceof Gtk.ApplicationWindow) {
            return;
        }

        if (child instanceof DialogNode) {
            return;
        }

        throw new Error(
            `Cannot remove '${child.typeName}' from 'Application': expected ApplicationWindow, Dialog, or MenuItem`,
        );
    }
}
