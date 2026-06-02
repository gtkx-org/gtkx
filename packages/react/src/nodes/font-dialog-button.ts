import * as Gtk from "@gtkx/gi/gtk";
import type { GtkFontDialogButtonProps } from "../jsx.js";
import type { BackingInstance } from "../types.js";
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
    ): BackingInstance | null {
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
            useFont: imperative(() => this.backingInstance.setUseFont(this.props.useFont ?? false)),
            useSize: imperative(() => this.backingInstance.setUseSize(this.props.useSize ?? false)),
            level: imperative(() => this.backingInstance.setLevel(this.props.level ?? Gtk.FontLevel.FONT)),
            fontDesc: imperative(() => {
                const { fontDesc } = this.props;
                if (fontDesc) this.backingInstance.setFontDesc(fontDesc);
            }),
            onFontDescChanged: signal("notify::font-desc", {
                getArgs: () => {
                    const fontDesc = this.backingInstance.getFontDesc();
                    return fontDesc ? [fontDesc] : null;
                },
            }),
        };
    }
}
