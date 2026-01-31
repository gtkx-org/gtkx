import type * as Gdk from "@gtkx/ffi/gdk";
import type * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import type { Container, Props } from "../types.js";
import type { SignalHandler } from "./internal/signal-store.js";
import { filterProps, hasChanged } from "./internal/utils.js";
import { WidgetNode } from "./widget.js";

type ColorDialogButtonProps = Props & {
    rgba?: Gdk.RGBA | null;
    onRgbaChanged?: (rgba: Gdk.RGBA) => void;
    title?: string;
    modal?: boolean;
    withAlpha?: boolean;
};

const OWN_PROPS = ["rgba", "onRgbaChanged", "title", "modal", "withAlpha"] as const;

export class ColorDialogButtonNode extends WidgetNode<Gtk.ColorDialogButton, ColorDialogButtonProps> {
    private dialog: Gtk.ColorDialog;
    private notifyHandler: SignalHandler | null = null;

    public static override createContainer(
        _props: ColorDialogButtonProps,
        containerClass: typeof Gtk.Widget,
    ): Container | null {
        const dialog = new Gtk.ColorDialog();
        const button = new (containerClass as typeof Gtk.ColorDialogButton)(dialog);
        return button;
    }

    constructor(
        type: string,
        props: ColorDialogButtonProps,
        container: Gtk.ColorDialogButton,
        rootContainer: Container,
    ) {
        super(type, props, container, rootContainer);
        const dialog = container.getDialog();
        if (!dialog) {
            throw new Error("ColorDialogButton must have a dialog");
        }
        this.dialog = dialog;
    }

    protected override applyUpdate(oldProps: ColorDialogButtonProps | null, newProps: ColorDialogButtonProps): void {
        super.applyUpdate(
            oldProps ? (filterProps(oldProps, OWN_PROPS) as ColorDialogButtonProps) : null,
            filterProps(newProps, OWN_PROPS) as ColorDialogButtonProps,
        );
        this.applyOwnProps(oldProps, newProps);
    }

    protected applyOwnProps(oldProps: ColorDialogButtonProps | null, newProps: ColorDialogButtonProps): void {
        if (hasChanged(oldProps, newProps, "title") && newProps.title !== undefined) {
            this.dialog.setTitle(newProps.title);
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
            this.setupNotifyHandler(newProps.onRgbaChanged);
        }
    }

    private setupNotifyHandler(callback?: (rgba: Gdk.RGBA) => void): void {
        if (this.notifyHandler) {
            this.signalStore.set(this, this.container, "notify", undefined);
            this.notifyHandler = null;
        }

        if (callback) {
            this.notifyHandler = (_button: Gtk.ColorDialogButton, pspec: GObject.ParamSpec) => {
                if (pspec.getName() === "rgba") {
                    const rgba = this.container.getRgba();
                    callback(rgba);
                }
            };
            this.signalStore.set(this, this.container, "notify", this.notifyHandler);
        }
    }

    public override detachDeletedInstance(): void {
        if (this.notifyHandler) {
            this.signalStore.set(this, this.container, "notify", undefined);
            this.notifyHandler = null;
        }
        super.detachDeletedInstance();
    }
}
