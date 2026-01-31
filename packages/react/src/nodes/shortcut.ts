import * as Gtk from "@gtkx/ffi/gtk";
import type { Props } from "../types.js";
import { hasChanged } from "./internal/utils.js";
import { VirtualNode } from "./virtual.js";

/**
 * Props for the Shortcut virtual element.
 *
 * Defines a keyboard shortcut. Must be a child of `x.ShortcutController`.
 *
 * @example
 * ```tsx
 * <x.ShortcutController>
 *     <x.Shortcut trigger="<Control>s" onActivate={save} />
 *     <x.Shortcut trigger={["F5", "<Control>r"]} onActivate={refresh} />
 *     <x.Shortcut trigger="Escape" onActivate={cancel} disabled={!canCancel} />
 * </x.ShortcutController>
 * ```
 */
export type ShortcutProps = Props & {
    /** The trigger string(s) using GTK accelerator format (e.g., "\<Control\>s", "F1") */
    trigger: string | string[];
    /**
     * Called when the shortcut is activated.
     * Return false to indicate the shortcut was not handled; otherwise it is considered handled.
     */
    // biome-ignore lint/suspicious/noConfusingVoidType: void is intentional - returning nothing means "handled"
    onActivate: () => boolean | void;
    /** Whether the shortcut is disabled */
    disabled?: boolean;
};

export class ShortcutNode extends VirtualNode<ShortcutProps> {
    public shortcut: Gtk.Shortcut | null = null;
    private action: Gtk.CallbackAction | null = null;

    public createShortcut(): void {
        const trigger = this.createTrigger();
        this.action = new Gtk.CallbackAction(() => {
            const result = this.props.onActivate();
            return result !== false;
        });
        this.shortcut = new Gtk.Shortcut(trigger, this.action);
    }

    public override commitUpdate(oldProps: ShortcutProps | null, newProps: ShortcutProps): void {
        super.commitUpdate(oldProps, newProps);
        this.applyOwnProps(oldProps, newProps);
    }

    protected applyOwnProps(oldProps: ShortcutProps | null, newProps: ShortcutProps): void {
        if (!this.shortcut) return;

        if (hasChanged(oldProps, newProps, "trigger") || hasChanged(oldProps, newProps, "disabled")) {
            this.shortcut.setTrigger(this.createTrigger());
        }
    }

    public override detachDeletedInstance(): void {
        this.shortcut = null;
        this.action = null;
        super.detachDeletedInstance();
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
