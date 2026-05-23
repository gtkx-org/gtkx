import * as Gtk from "@gtkx/ffi/gtk";
import type { GtkFontDialogButtonProps } from "../jsx.js";
import type { Container } from "../types.js";
import { DialogButtonNode } from "./dialog-button.js";
import { imperative, type PropDescriptorTable, signal } from "./internal/apply-props.js";

type FontDialogButtonProps = Pick<
    GtkFontDialogButtonProps,
    | "fontDesc"
    | "onFontDescChanged"
    | "title"
    | "modal"
    | "language"
    | "filter"
    | "fontMap"
    | "useFont"
    | "useSize"
    | "level"
>;

export class FontDialogButtonNode extends DialogButtonNode<
    Gtk.FontDialog,
    Gtk.FontDialogButton,
    FontDialogButtonProps
> {
    public static override createContainer(
        _typeName: string,
        _props: FontDialogButtonProps,
        containerClass: typeof Gtk.FontDialogButton,
    ): Container | null {
        return new containerClass({ dialog: new Gtk.FontDialog() });
    }

    protected override ownPropDescriptors(): PropDescriptorTable {
        return {
            ...super.ownPropDescriptors(),
            language: imperative(() => {
                const { language } = this.props;
                if (language) this.dialog.setLanguage(language);
            }),
            filter: imperative(() => this.dialog.setFilter(this.props.filter ?? null)),
            fontMap: imperative(() => this.dialog.setFontMap(this.props.fontMap ?? null)),
            useFont: imperative(() => this.container.setUseFont(this.props.useFont ?? false)),
            useSize: imperative(() => this.container.setUseSize(this.props.useSize ?? false)),
            level: imperative(() => this.container.setLevel(this.props.level ?? Gtk.FontLevel.FONT)),
            fontDesc: imperative(() => {
                const { fontDesc } = this.props;
                if (fontDesc) this.container.setFontDesc(fontDesc);
            }),
            onFontDescChanged: signal("notify::font-desc", {
                getArgs: () => {
                    const fontDesc = this.container.getFontDesc();
                    return fontDesc ? [fontDesc] : null;
                },
            }),
        };
    }
}
