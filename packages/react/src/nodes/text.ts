import * as Gtk from "@gtkx/ffi/gtk";
import type { Props } from "../factory.js";
import type { Node } from "../node.js";
import { appendChild, removeChild } from "../widget-capabilities.js";

/**
 * Node implementation for text content.
 * Wraps string children in a GTK Label widget.
 */
export class TextNode implements Node<Gtk.Label> {
    private label: Gtk.Label;

    constructor(text: string) {
        this.label = new Gtk.Label(text);
    }

    getWidget(): Gtk.Label {
        return this.label;
    }

    updateText(text: string): void {
        this.label.setLabel(text);
    }

    appendChild(_child: Node): void {}

    removeChild(_child: Node): void {}

    insertBefore(_child: Node, _before: Node): void {}

    updateProps(_oldProps: Props, _newProps: Props): void {}

    mount(): void {}

    attachToParent(parent: Node): void {
        const parentWidget = parent.getWidget?.();
        if (parentWidget) {
            appendChild(parentWidget, this.label);
        }
    }

    detachFromParent(parent: Node): void {
        const parentWidget = parent.getWidget?.();
        if (parentWidget) {
            removeChild(parentWidget, this.label);
        }
    }
}
