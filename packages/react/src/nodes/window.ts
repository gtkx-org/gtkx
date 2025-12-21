import { getApplication } from "@gtkx/ffi";
import * as Adw from "@gtkx/ffi/adw";
import * as Gtk from "@gtkx/ffi/gtk";
import { WINDOW_TYPES } from "../constants.js";
import type { Props } from "../factory.js";
import { Node, normalizeWidgetType } from "../node.js";

export class WindowNode extends Node<Gtk.Window> {
    static override consumedPropNames = ["defaultWidth", "defaultHeight"];

    static matches(type: string): boolean {
        return WINDOW_TYPES.has(normalizeWidgetType(type));
    }

    protected override isStandalone(): boolean {
        return true;
    }

    protected override createWidget(type: string, _props: Props): Gtk.Window {
        const widgetType = normalizeWidgetType(type);

        if (widgetType === "GtkApplicationWindow") {
            return new Gtk.ApplicationWindow(getApplication());
        }

        if (widgetType === "AdwApplicationWindow") {
            return new Adw.ApplicationWindow(getApplication());
        }

        if (widgetType === "AdwWindow") {
            return new Adw.Window();
        }

        return new Gtk.Window();
    }

    override mount(): void {
        this.widget.present();
    }

    override unmount(): void {
        this.widget.destroy();
        super.unmount();
    }

    override updateProps(oldProps: Props, newProps: Props): void {
        const widthChanged = oldProps.defaultWidth !== newProps.defaultWidth;
        const heightChanged = oldProps.defaultHeight !== newProps.defaultHeight;

        if (widthChanged || heightChanged) {
            const width = (newProps.defaultWidth as number | undefined) ?? -1;
            const height = (newProps.defaultHeight as number | undefined) ?? -1;
            this.widget.setDefaultSize(width, height);
        }

        super.updateProps(oldProps, newProps);
    }
}
