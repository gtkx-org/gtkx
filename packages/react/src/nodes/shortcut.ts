import * as Gtk from "@gtkx/ffi/gtk";
import type { ShortcutProps } from "../jsx.js";
import type { Node } from "../node.js";
import { EventControllerNode } from "./event-controller.js";
import { hasChanged } from "./internal/props.js";
import { VirtualNode } from "./virtual.js";

export class ShortcutNode extends VirtualNode<ShortcutProps, EventControllerNode<Gtk.ShortcutController>, never> {
    public override isValidChild(_child: Node): boolean {
        return false;
    }

    public override isValidParent(parent: Node): boolean {
        return parent instanceof EventControllerNode && parent.container instanceof Gtk.ShortcutController;
    }
    private shortcut: Gtk.Shortcut | null = null;
    private action: Gtk.CallbackAction | null = null;

    public override commitUpdate(oldProps: ShortcutProps | null, newProps: ShortcutProps): void {
        super.commitUpdate(oldProps, newProps);
        this.applyOwnProps(oldProps, newProps);
    }

    public override detachDeletedInstance(): void {
        this.shortcut = null;
        this.action = null;
        super.detachDeletedInstance();
    }

    public getShortcut(): Gtk.Shortcut | null {
        return this.shortcut;
    }

    public createShortcut(): void {
        const trigger = this.createTrigger();
        this.action = new Gtk.CallbackAction(() => {
            const result = this.props.onActivate();
            return result !== false;
        });
        this.shortcut = new Gtk.Shortcut(trigger, this.action);
    }

    private applyOwnProps(oldProps: ShortcutProps | null, newProps: ShortcutProps): void {
        if (!this.shortcut) return;

        if (hasChanged(oldProps, newProps, "trigger") || hasChanged(oldProps, newProps, "disabled")) {
            this.shortcut.setTrigger(this.createTrigger());
        }
    }

    private createTrigger(): Gtk.ShortcutTrigger {
        if (this.props.disabled) {
            return Gtk.NeverTrigger.get();
        }

        const { trigger } = this.props;
        const triggers = Array.isArray(trigger) ? trigger : [trigger];

        if (triggers.length === 0) {
            return Gtk.NeverTrigger.get();
        }

        let result: Gtk.ShortcutTrigger = new Gtk.ShortcutTrigger(triggers[0] as string);
        for (let i = 1; i < triggers.length; i++) {
            result = new Gtk.AlternativeTrigger(result, new Gtk.ShortcutTrigger(triggers[i] as string));
        }
        return result;
    }
}
