import type * as gtk from "@gtkx/ffi/gtk";
import type { Props } from "../factory.js";
import type { Node } from "../node.js";
import { disconnectSignalHandlers, isConnectable, isPresentable } from "../widget-capabilities.js";

const DIALOG_TYPES = ["FileDialog", "ColorDialog", "FontDialog", "AlertDialog", "AboutDialog"];

interface FileDialogWidget extends gtk.Widget {
    open(parent?: unknown): Promise<unknown>;
    save(parent?: unknown): Promise<unknown>;
    selectFolder(parent?: unknown): Promise<unknown>;
    openMultiple(parent?: unknown): Promise<unknown>;
}

const isFileDialog = (dialog: gtk.Widget): dialog is FileDialogWidget =>
    "open" in dialog && typeof dialog.open === "function";

interface DestroyableWidget extends gtk.Widget {
    destroy(): void;
}

const isDestroyable = (widget: gtk.Widget): widget is DestroyableWidget =>
    "destroy" in widget && typeof widget.destroy === "function";

/**
 * Node implementation for GTK dialog widgets.
 * Handles non-widget dialogs like FileDialog, ColorDialog, etc.
 */
export class DialogNode implements Node {
    static needsWidget = true;

    static matches(type: string, widget: gtk.Widget | null): widget is gtk.Widget {
        return DIALOG_TYPES.includes(type) && widget !== null;
    }

    private dialogType: string;
    private dialog: gtk.Widget;
    private initialProps: Props;
    private signalHandlers = new Map<string, number>();

    constructor(dialogType: string, dialog: gtk.Widget, initialProps: Props) {
        this.dialogType = dialogType;
        this.dialog = dialog;
        this.initialProps = initialProps;
    }

    appendChild(_child: Node): void {}

    removeChild(_child: Node): void {}

    insertBefore(_child: Node, _before: Node): void {}

    updateProps(oldProps: Props, newProps: Props): void {
        const allKeys = new Set([...Object.keys(oldProps), ...Object.keys(newProps)]);

        for (const key of allKeys) {
            if (key === "children" || key === "mode" || key === "parent") continue;

            const oldValue = oldProps[key];
            const newValue = newProps[key];

            if (oldValue === newValue) continue;

            if (key.startsWith("on")) {
                const eventName = key
                    .slice(2)
                    .replace(/([A-Z])/g, "-$1")
                    .toLowerCase()
                    .replace(/^-/, "");

                const oldHandlerId = this.signalHandlers.get(eventName);
                if (oldHandlerId !== undefined && isConnectable(this.dialog)) {
                    this.signalHandlers.delete(eventName);
                }

                if (typeof newValue === "function" && isConnectable(this.dialog)) {
                    const handlerId = this.dialog.connect(eventName, newValue as (...args: unknown[]) => void);
                    this.signalHandlers.set(eventName, handlerId);
                }
                continue;
            }

            const setterName = `set${key.charAt(0).toUpperCase()}${key.slice(1)}`;
            if (typeof this.dialog[setterName as keyof gtk.Widget] === "function") {
                (this.dialog[setterName as keyof gtk.Widget] as (value: unknown) => void)(newValue);
            }
        }
    }

    mount(): void {
        if (this.dialogType === "AboutDialog" && isPresentable(this.dialog)) {
            this.dialog.present();
            return;
        }

        if (this.dialogType !== "FileDialog" || !isFileDialog(this.dialog)) return;

        const mode = this.initialProps.mode as string | undefined;
        const parentWindow = this.initialProps.parent as unknown;
        const onResponse = this.initialProps.onResponse as ((result: unknown) => void) | undefined;

        const methodMap = {
            save: this.dialog.save.bind(this.dialog),
            selectFolder: this.dialog.selectFolder.bind(this.dialog),
            openMultiple: this.dialog.openMultiple.bind(this.dialog),
        } as const;

        const method = (mode && methodMap[mode as keyof typeof methodMap]) || this.dialog.open.bind(this.dialog);
        method(parentWindow)
            .then((result) => onResponse?.(result))
            .catch(() => onResponse?.(null));
    }

    attachToParent(_parent: Node): void {}

    detachFromParent(_parent: Node): void {}

    dispose(): void {
        disconnectSignalHandlers(this.dialog, this.signalHandlers);
        if (isDestroyable(this.dialog)) {
            this.dialog.destroy();
        }
    }
}
