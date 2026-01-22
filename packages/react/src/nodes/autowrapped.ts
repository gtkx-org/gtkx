import { isObjectEqual } from "@gtkx/ffi";
import * as Gtk from "@gtkx/ffi/gtk";
import { AUTOWRAP_CLASSES } from "../generated/internal.js";
import type { Node } from "../node.js";
import { registerNodeClass } from "../registry.js";
import type { Container, ContainerClass } from "../types.js";
import { isRemovable, isSingleChild } from "./internal/predicates.js";
import { matchesAnyClass } from "./internal/utils.js";
import { SlotNode } from "./slot.js";
import { WidgetNode } from "./widget.js";

type AutowrappingContainer = Gtk.ListBox | Gtk.FlowBox;
type AutowrappedChild = Gtk.ListBoxRow | Gtk.FlowBoxChild;

const isAutowrappedChild = (obj: unknown): obj is AutowrappedChild => {
    return obj instanceof Gtk.ListBoxRow || obj instanceof Gtk.FlowBoxChild;
};

class AutowrappedNode extends WidgetNode<AutowrappingContainer> {
    public static override priority = 1;

    public static override matches(_type: string, containerOrClass?: Container | ContainerClass | null): boolean {
        return matchesAnyClass(AUTOWRAP_CLASSES, containerOrClass);
    }

    public override appendChild(child: Node): void {
        if (child instanceof SlotNode) {
            super.appendChild(child);
            return;
        }

        if (!(child instanceof WidgetNode)) {
            throw new Error(`Cannot append '${child.typeName}' to 'ListBox/FlowBox': expected Widget`);
        }

        if (isAutowrappedChild(child.container)) {
            const currentParent = child.container.getParent();
            if (currentParent !== null && isRemovable(currentParent)) {
                currentParent.remove(child.container);
            }
        } else {
            this.removeExistingWrapper(child.container);
        }

        this.container.append(child.container);
    }

    public override removeChild(child: Node): void {
        if (child instanceof SlotNode) {
            super.removeChild(child);
            return;
        }

        if (!(child instanceof WidgetNode)) {
            throw new Error(`Cannot remove '${child.typeName}' from 'ListBox/FlowBox': expected Widget`);
        }

        if (!isAutowrappedChild(child.container)) {
            const wrapper = child.container.getParent();

            if (wrapper && isSingleChild(wrapper)) {
                wrapper.setChild(null);
                this.container.remove(wrapper);
                return;
            }
        }

        this.container.remove(child.container);
    }

    public override insertBefore(child: Node, before: Node): void {
        if (child instanceof SlotNode) {
            super.insertBefore(child, before);
            return;
        }

        if (!(child instanceof WidgetNode) || !(before instanceof WidgetNode)) {
            throw new Error(`Cannot insert '${child.typeName}' into 'ListBox/FlowBox': expected Widget`);
        }

        const currentParent = child.container.getParent();

        if (currentParent !== null) {
            if (isAutowrappedChild(child.container)) {
                if (isRemovable(currentParent)) {
                    currentParent.remove(child.container);
                }
            } else {
                this.removeExistingWrapper(child.container);
            }
        } else if (!isAutowrappedChild(child.container)) {
            this.removeExistingWrapper(child.container);
        }

        const position = this.findChildPosition(before);

        if (position !== null) {
            this.container.insert(child.container, position);
        } else {
            this.container.append(child.container);
        }
    }

    private removeExistingWrapper(childWidget: Gtk.Widget): void {
        const existingWrapper = childWidget.getParent();

        if (existingWrapper && isSingleChild(existingWrapper)) {
            existingWrapper.setChild(null);
            const wrapperParent = existingWrapper.getParent();

            if (wrapperParent !== null && isRemovable(wrapperParent)) {
                wrapperParent.remove(existingWrapper);
            }
        }
    }

    private findChildPosition(before: WidgetNode): number | null {
        let position = 0;
        let currentChild = this.container.getFirstChild();
        const beforeIsWrapper = isAutowrappedChild(before.container);

        while (currentChild) {
            const widgetToCompare = beforeIsWrapper ? currentChild : this.unwrapChild(currentChild);

            if (widgetToCompare && isObjectEqual(widgetToCompare, before.container)) {
                return position;
            }

            position++;
            currentChild = currentChild.getNextSibling();
        }

        return null;
    }

    private unwrapChild(child: Gtk.Widget): Gtk.Widget | null {
        if ("getChild" in child && typeof child.getChild === "function") {
            return child.getChild() as Gtk.Widget | null;
        }

        return child;
    }
}

registerNodeClass(AutowrappedNode);
