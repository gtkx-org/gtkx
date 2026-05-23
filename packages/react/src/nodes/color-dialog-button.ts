import * as Gtk from "@gtkx/ffi/gtk";
import type { GtkColorDialogButtonProps } from "../jsx.js";
import type { Container } from "../types.js";
import { DialogButtonNode } from "./dialog-button.js";
import { imperative, type PropDescriptorTable, signal } from "./internal/apply-props.js";

type ColorDialogButtonProps = Pick<
    GtkColorDialogButtonProps,
    "rgba" | "onRgbaChanged" | "title" | "modal" | "withAlpha"
>;

export class ColorDialogButtonNode extends DialogButtonNode<
    Gtk.ColorDialog,
    Gtk.ColorDialogButton,
    ColorDialogButtonProps
> {
    public static override createContainer(
        _typeName: string,
        _props: ColorDialogButtonProps,
        containerClass: typeof Gtk.ColorDialogButton,
    ): Container | null {
        return new containerClass({ dialog: new Gtk.ColorDialog() });
    }

    protected override ownPropDescriptors(): PropDescriptorTable {
        return {
            ...super.ownPropDescriptors(),
            withAlpha: imperative(() => this.dialog.setWithAlpha(this.props.withAlpha ?? true)),
            rgba: imperative(() => {
                const { rgba } = this.props;
                if (rgba) this.container.setRgba(rgba);
            }),
            onRgbaChanged: signal("notify::rgba", { getArgs: () => [this.container.getRgba()] }),
        };
    }
}
