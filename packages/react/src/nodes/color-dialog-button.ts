import * as Gtk from "@gtkx/ffi/gtk";
import type { GtkColorDialogButtonProps } from "../jsx.js";
import type { Container } from "../types.js";
import { filterProps, hasChanged } from "./internal/props.js";
import { WidgetNode } from "./widget.js";

const OWN_PROPS = ["rgba", "onRgbaChanged", "title", "modal", "withAlpha"] as const;

type ColorDialogButtonProps = Pick<GtkColorDialogButtonProps, (typeof OWN_PROPS)[number]>;

export class ColorDialogButtonNode extends WidgetNode<Gtk.ColorDialogButton, ColorDialogButtonProps> {
    private readonly dialog: Gtk.ColorDialog;

    public static override createContainer(
        _props: ColorDialogButtonProps,
        containerClass: typeof Gtk.Widget,
    ): Container | null {
        const dialog = new Gtk.ColorDialog();
        const button = new (containerClass as typeof Gtk.ColorDialogButton)(dialog);
        return button;
    }

    constructor(
        typeName: string,
        props: ColorDialogButtonProps,
        container: Gtk.ColorDialogButton,
        rootContainer: Container,
    ) {
        super(typeName, props, container, rootContainer);
        const dialog = container.getDialog();
        if (!dialog) {
            throw new Error("ColorDialogButton must have a dialog");
        }
        this.dialog = dialog;
    }

    public override commitUpdate(oldProps: ColorDialogButtonProps | null, newProps: ColorDialogButtonProps): void {
        super.commitUpdate(oldProps ? filterProps(oldProps, OWN_PROPS) : null, filterProps(newProps, OWN_PROPS));
        this.applyOwnProps(oldProps, newProps);
    }

    private applyOwnProps(oldProps: ColorDialogButtonProps | null, newProps: ColorDialogButtonProps): void {
        if (hasChanged(oldProps, newProps, "title")) {
            this.dialog.setTitle(newProps.title ?? "");
        }

        if (hasChanged(oldProps, newProps, "modal")) {
            this.dialog.setModal(newProps.modal ?? true);
        }

        if (hasChanged(oldProps, newProps, "withAlpha")) {
            this.dialog.setWithAlpha(newProps.withAlpha ?? true);
        }

        if (hasChanged(oldProps, newProps, "rgba") && newProps.rgba) {
            this.container.setRgba(newProps.rgba);
        }

        if (hasChanged(oldProps, newProps, "onRgbaChanged")) {
            const callback = newProps.onRgbaChanged;
            this.signalStore.set(
                this,
                this.container,
                "notify::rgba",
                callback ? () => callback(this.container.getRgba()) : undefined,
            );
        }
    }
}
