import * as gtk from "@gtkx/ffi/gtk";
import type { Props } from "../factory.js";
import type { Node } from "../node.js";

export class TextNode implements Node {
    private label: gtk.Label;

    constructor(text: string) {
        this.label = new gtk.Label(text);
    }

    getWidget(): gtk.Label {
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
        if (!parentWidget) return;

        if ("setChild" in parentWidget && typeof parentWidget.setChild === "function") {
            (parentWidget.setChild as (ptr: unknown) => void)(this.label.ptr);
        } else if ("append" in parentWidget && typeof parentWidget.append === "function") {
            (parentWidget.append as (ptr: unknown) => void)(this.label.ptr);
        }
    }

    detachFromParent(parent: Node): void {
        const parentWidget = parent.getWidget?.();
        if (!parentWidget) return;

        if ("remove" in parentWidget && typeof parentWidget.remove === "function") {
            (parentWidget.remove as (ptr: unknown) => void)(this.label.ptr);
        } else if ("setChild" in parentWidget && typeof parentWidget.setChild === "function") {
            (parentWidget.setChild as (ptr: null) => void)(null);
        }
    }
}
