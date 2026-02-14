import * as Gtk from "@gtkx/ffi/gtk";
import type { GtkFontDialogButtonProps } from "../jsx.js";
import type { Container } from "../types.js";
import { filterProps, hasChanged } from "./internal/props.js";
import { WidgetNode } from "./widget.js";

const OWN_PROPS = [
    "fontDesc",
    "onFontDescChanged",
    "title",
    "modal",
    "language",
    "filter",
    "fontMap",
    "useFont",
    "useSize",
    "level",
] as const;

type FontDialogButtonProps = Pick<GtkFontDialogButtonProps, (typeof OWN_PROPS)[number]>;

export class FontDialogButtonNode extends WidgetNode<Gtk.FontDialogButton, FontDialogButtonProps> {
    private dialog: Gtk.FontDialog;

    public static override createContainer(
        _props: FontDialogButtonProps,
        containerClass: typeof Gtk.Widget,
    ): Container | null {
        const dialog = new Gtk.FontDialog();
        const button = new (containerClass as typeof Gtk.FontDialogButton)(dialog);
        return button;
    }

    constructor(
        typeName: string,
        props: FontDialogButtonProps,
        container: Gtk.FontDialogButton,
        rootContainer: Container,
    ) {
        super(typeName, props, container, rootContainer);
        const dialog = container.getDialog();
        if (!dialog) {
            throw new Error("FontDialogButton must have a dialog");
        }
        this.dialog = dialog;
    }

    public override commitUpdate(oldProps: FontDialogButtonProps | null, newProps: FontDialogButtonProps): void {
        super.commitUpdate(oldProps ? filterProps(oldProps, OWN_PROPS) : null, filterProps(newProps, OWN_PROPS));
        this.applyOwnProps(oldProps, newProps);
    }

    private applyOwnProps(oldProps: FontDialogButtonProps | null, newProps: FontDialogButtonProps): void {
        if (hasChanged(oldProps, newProps, "title")) {
            this.dialog.setTitle(newProps.title ?? "");
        }

        if (hasChanged(oldProps, newProps, "modal")) {
            this.dialog.setModal(newProps.modal ?? true);
        }

        if (hasChanged(oldProps, newProps, "language") && newProps.language) {
            this.dialog.setLanguage(newProps.language);
        }

        if (hasChanged(oldProps, newProps, "filter")) {
            this.dialog.setFilter(newProps.filter);
        }

        if (hasChanged(oldProps, newProps, "fontMap")) {
            this.dialog.setFontMap(newProps.fontMap);
        }

        if (hasChanged(oldProps, newProps, "useFont")) {
            this.container.setUseFont(newProps.useFont ?? false);
        }

        if (hasChanged(oldProps, newProps, "useSize")) {
            this.container.setUseSize(newProps.useSize ?? false);
        }

        if (hasChanged(oldProps, newProps, "level")) {
            this.container.setLevel(newProps.level ?? Gtk.FontLevel.FONT);
        }

        if (hasChanged(oldProps, newProps, "fontDesc") && newProps.fontDesc) {
            this.container.setFontDesc(newProps.fontDesc);
        }

        if (hasChanged(oldProps, newProps, "onFontDescChanged")) {
            const callback = newProps.onFontDescChanged;
            this.signalStore.set(
                this,
                this.container,
                "notify::font-desc",
                callback
                    ? () => {
                          const fontDesc = this.container.getFontDesc();
                          if (fontDesc) {
                              callback(fontDesc);
                          }
                      }
                    : undefined,
            );
        }
    }
}
