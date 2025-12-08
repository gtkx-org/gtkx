import { getCurrentApp } from "@gtkx/ffi";
import * as Gtk from "@gtkx/ffi/gtk";
import type { Props } from "../factory.js";
import { Node } from "../node.js";
import { getNumberProp } from "../prop-utils.js";

export class WindowNode extends Node<Gtk.Window> {
    static matches(type: string): boolean {
        return type === "Window" || type === "ApplicationWindow";
    }

    protected override createWidget(type: string, _props: Props): Gtk.Window {
        if (type === "ApplicationWindow") {
            return new Gtk.ApplicationWindow(getCurrentApp());
        }
        return new Gtk.Window();
    }

    override detachFromParent(_parent: Node): void {
        this.widget.destroy();
    }

    override mount(): void {
        this.widget.present();
    }

    protected override consumedProps(): Set<string> {
        const consumed = super.consumedProps();
        consumed.add("defaultWidth");
        consumed.add("defaultHeight");
        return consumed;
    }

    override updateProps(oldProps: Props, newProps: Props): void {
        const widthChanged = oldProps.defaultWidth !== newProps.defaultWidth;
        const heightChanged = oldProps.defaultHeight !== newProps.defaultHeight;

        if (widthChanged || heightChanged) {
            const width = getNumberProp(newProps, "defaultWidth", -1);
            const height = getNumberProp(newProps, "defaultHeight", -1);
            this.widget.setDefaultSize(width, height);
        }

        super.updateProps(oldProps, newProps);
    }
}
