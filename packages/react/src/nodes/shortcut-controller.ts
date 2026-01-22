import * as Gtk from "@gtkx/ffi/gtk";
import type { Node } from "../node.js";
import { registerNodeClass } from "../registry.js";
import type { Props } from "../types.js";
import { hasChanged } from "./internal/utils.js";
import { ShortcutNode } from "./shortcut.js";
import { VirtualNode } from "./virtual.js";
import { WidgetNode } from "./widget.js";

/**
 * Props for the ShortcutController virtual element.
 *
 * Attaches keyboard shortcuts to a widget. Must contain `x.Shortcut` children.
 *
 * @example
 * ```tsx
 * <GtkBox>
 *     <x.ShortcutController scope={Gtk.ShortcutScope.GLOBAL}>
 *         <x.Shortcut trigger="<Control>f" onActivate={toggleSearch} />
 *         <x.Shortcut trigger="<Control>q" onActivate={quit} />
 *     </x.ShortcutController>
 * </GtkBox>
 * ```
 */
export type ShortcutControllerProps = Props & {
    /** The scope for shortcuts (LOCAL, MANAGED, or GLOBAL) */
    scope?: Gtk.ShortcutScope;
};

class ShortcutControllerNode extends VirtualNode<ShortcutControllerProps> {
    public static override priority = 1;

    public static override matches(type: string): boolean {
        return type === "ShortcutController";
    }

    private controller: Gtk.ShortcutController | null = null;
    private parentWidget: Gtk.Widget | null = null;
    private shortcuts: ShortcutNode[] = [];

    public setParent(widget: Gtk.Widget | null): void {
        if (this.parentWidget && this.controller) {
            this.parentWidget.removeController(this.controller);
        }

        this.parentWidget = widget;

        if (widget) {
            this.controller = new Gtk.ShortcutController();
            this.applyScope();
            widget.addController(this.controller);

            for (const shortcut of this.shortcuts) {
                this.addShortcutToController(shortcut);
            }
        } else {
            this.controller = null;
        }
    }

    public override appendChild(child: Node): void {
        if (!(child instanceof ShortcutNode)) {
            throw new Error(`ShortcutController only accepts Shortcut children, got '${child.typeName}'`);
        }

        this.shortcuts.push(child);
        if (this.controller) {
            this.addShortcutToController(child);
        }
    }

    public override removeChild(child: Node): void {
        if (!(child instanceof ShortcutNode)) return;

        const index = this.shortcuts.indexOf(child);
        if (index !== -1) {
            this.shortcuts.splice(index, 1);
            if (this.controller && child.shortcut) {
                this.controller.removeShortcut(child.shortcut);
            }
        }
    }

    public override updateProps(oldProps: ShortcutControllerProps | null, newProps: ShortcutControllerProps): void {
        super.updateProps(oldProps, newProps);
        this.applyOwnProps(oldProps, newProps);
    }

    protected applyOwnProps(oldProps: ShortcutControllerProps | null, newProps: ShortcutControllerProps): void {
        if (hasChanged(oldProps, newProps, "scope")) {
            this.applyScope();
        }
    }

    public override unmount(): void {
        this.setParent(null);
        super.unmount();
    }

    public canBeChildOf(parent: Node): boolean {
        return parent instanceof WidgetNode;
    }

    public attachTo(parent: Node): void {
        if (parent instanceof WidgetNode) {
            this.setParent(parent.container);
        }
    }

    public detachFrom(_parent: Node): void {
        this.setParent(null);
    }

    private applyScope(): void {
        if (!this.controller) return;
        this.controller.setScope(this.props.scope ?? Gtk.ShortcutScope.LOCAL);
    }

    private addShortcutToController(node: ShortcutNode): void {
        if (!this.controller) return;
        node.createShortcut();
        if (node.shortcut) {
            this.controller.addShortcut(node.shortcut);
        }
    }
}

registerNodeClass(ShortcutControllerNode);
