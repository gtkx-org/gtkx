import type * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import type * as Pango from "@gtkx/ffi/pango";
import type { Container, Props } from "../types.js";
import type { SignalHandler } from "./internal/signal-store.js";
import { filterProps, hasChanged } from "./internal/utils.js";
import { WidgetNode } from "./widget.js";

type FontDialogButtonProps = Props & {
    fontDesc?: Pango.FontDescription | null;
    onFontDescChanged?: (fontDesc: Pango.FontDescription) => void;
    title?: string;
    modal?: boolean;
    language?: Pango.Language | null;
    useFont?: boolean;
    useSize?: boolean;
    level?: Gtk.FontLevel;
};

const OWN_PROPS = [
    "fontDesc",
    "onFontDescChanged",
    "title",
    "modal",
    "language",
    "useFont",
    "useSize",
    "level",
] as const;

export class FontDialogButtonNode extends WidgetNode<Gtk.FontDialogButton, FontDialogButtonProps> {
    private dialog: Gtk.FontDialog;
    private notifyHandler: SignalHandler | null = null;

    public static override createContainer(
        _props: FontDialogButtonProps,
        containerClass: typeof Gtk.Widget,
    ): Container | null {
        const dialog = new Gtk.FontDialog();
        const button = new (containerClass as typeof Gtk.FontDialogButton)(dialog);
        return button;
    }

    constructor(type: string, props: FontDialogButtonProps, container: Gtk.FontDialogButton, rootContainer: Container) {
        super(type, props, container, rootContainer);
        const dialog = container.getDialog();
        if (!dialog) {
            throw new Error("FontDialogButton must have a dialog");
        }
        this.dialog = dialog;
    }

    public override updateProps(oldProps: FontDialogButtonProps | null, newProps: FontDialogButtonProps): void {
        super.updateProps(
            oldProps ? (filterProps(oldProps, OWN_PROPS) as FontDialogButtonProps) : null,
            filterProps(newProps, OWN_PROPS) as FontDialogButtonProps,
        );
        this.applyOwnProps(oldProps, newProps);
    }

    protected applyOwnProps(oldProps: FontDialogButtonProps | null, newProps: FontDialogButtonProps): void {
        if (hasChanged(oldProps, newProps, "title") && newProps.title !== undefined) {
            this.dialog.setTitle(newProps.title);
        }

        if (hasChanged(oldProps, newProps, "modal")) {
            this.dialog.setModal(newProps.modal ?? true);
        }

        if (hasChanged(oldProps, newProps, "language") && newProps.language) {
            this.dialog.setLanguage(newProps.language);
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
            this.setupNotifyHandler(newProps.onFontDescChanged);
        }
    }

    private setupNotifyHandler(callback?: (fontDesc: Pango.FontDescription) => void): void {
        if (this.notifyHandler) {
            this.signalStore.set(this, this.container, "notify", undefined);
            this.notifyHandler = null;
        }

        if (callback) {
            this.notifyHandler = (_button: Gtk.FontDialogButton, pspec: GObject.ParamSpec) => {
                if (pspec.getName() === "font-desc") {
                    const fontDesc = this.container.getFontDesc();
                    if (fontDesc) {
                        callback(fontDesc);
                    }
                }
            };
            this.signalStore.set(this, this.container, "notify", this.notifyHandler);
        }
    }

    public override unmount(): void {
        if (this.notifyHandler) {
            this.signalStore.set(this, this.container, "notify", undefined);
            this.notifyHandler = null;
        }
        super.unmount();
    }
}
