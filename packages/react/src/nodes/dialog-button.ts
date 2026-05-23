import type * as Gtk from "@gtkx/ffi/gtk";
import type { DialogButtonProps } from "../jsx.js";
import type { Container } from "../types.js";
import { imperative, type PropDescriptorTable } from "./internal/apply-props.js";
import { WidgetNode } from "./widget.js";

/** A chooser dialog carrying the title/modal properties a {@link DialogButtonNode} drives. */
type ChooserDialog = {
    setTitle: (title: string) => void;
    setModal: (modal: boolean) => void;
};

/** A button widget that owns a chooser dialog. */
type DialogButton<TDialog> = Gtk.Widget & {
    getDialog: () => TDialog | null;
};

/**
 * Base node for button widgets that own a chooser dialog — `GtkColorDialogButton`
 * and `GtkFontDialogButton`.
 *
 * The dialog is extracted from the button at construction and exposed to
 * subclasses as {@link dialog}; the shared `title` and `modal` props are applied
 * to it. Subclasses contribute their widget-specific props by spreading
 * `super.ownPropDescriptors()`.
 */
export class DialogButtonNode<
    TDialog extends ChooserDialog,
    TButton extends DialogButton<TDialog> = DialogButton<TDialog>,
    P extends DialogButtonProps = DialogButtonProps,
> extends WidgetNode<TButton, P> {
    protected readonly dialog: TDialog;

    constructor(typeName: string, props: P, container: TButton, rootContainer: Container) {
        super(typeName, props, container, rootContainer);
        const dialog = container.getDialog();
        if (!dialog) {
            throw new Error(`${typeName} must have a dialog`);
        }
        this.dialog = dialog;
    }

    protected override ownPropDescriptors(): PropDescriptorTable {
        return {
            ...super.ownPropDescriptors(),
            title: imperative(() => this.dialog.setTitle(this.props.title ?? "")),
            modal: imperative(() => this.dialog.setModal(this.props.modal ?? true)),
        };
    }
}
