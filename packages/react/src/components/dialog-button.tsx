import type * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import type * as Pango from "@gtkx/gi/pango";
import { createElement, type ElementType, type ReactNode, useLayoutEffect, useRef } from "react";

/** The prop shape {@link withColorDialog} reads from its host element. */
type ColorDialogHostProps = {
    /** Title for the chooser dialog. */
    title?: string;
    /** Whether the dialog is modal. */
    modal?: boolean;
    /** Whether to show an alpha (opacity) channel. */
    withAlpha?: boolean;
    /** Callback fired when the selected color changes. */
    onRgbaChanged?: ((rgba: Gdk.RGBA) => void) | null;
};

/**
 * Builds a color-dialog-button component that owns the `Gtk.ColorDialog` its
 * button opens: the dialog is constructed once, passed to the host element's
 * `dialog` property, and reconfigured from the `title`/`modal`/`withAlpha`
 * props on every commit. `onRgbaChanged` observes the button's `rgba`
 * property through the generic notify path.
 *
 * @typeParam P - The component prop shape.
 * @param Element - The color-dialog-button host intrinsic to render.
 * @returns A component that manages the button's dialog.
 */
export const withColorDialog = <P extends ColorDialogHostProps>(Element: ElementType): ((props: P) => ReactNode) => {
    return (props: P): ReactNode => {
        const { title, modal, withAlpha, onRgbaChanged, ...rest } = props;
        const dialogRef = useRef<Gtk.ColorDialog | null>(null);
        dialogRef.current ??= new Gtk.ColorDialog();
        const dialog = dialogRef.current;

        useLayoutEffect(() => {
            dialog.setTitle(title ?? "");
            dialog.setModal(modal ?? true);
            dialog.setWithAlpha(withAlpha ?? true);
        });

        return createElement(Element, {
            ...rest,
            dialog,
            onNotifyRgba: onRgbaChanged ? (rgba: Gdk.RGBA | null) => onRgbaChanged(rgba as Gdk.RGBA) : undefined,
        });
    };
};

/** The prop shape {@link withFontDialog} reads from its host element. */
type FontDialogHostProps = {
    /** Title for the chooser dialog. */
    title?: string;
    /** Whether the dialog is modal. */
    modal?: boolean;
    /** Language used to display sample text in the dialog. */
    language?: Pango.Language;
    /** Filter to restrict which fonts are shown in the dialog. */
    filter?: Gtk.Filter | null;
    /** Custom font map to select fonts from. */
    fontMap?: Pango.FontMap | null;
    /** Callback fired when the selected font changes. */
    onFontDescChanged?: ((fontDesc: Pango.FontDescription) => void) | null;
};

/**
 * Builds a font-dialog-button component that owns the `Gtk.FontDialog` its
 * button opens: the dialog is constructed once, passed to the host element's
 * `dialog` property, and reconfigured from the
 * `title`/`modal`/`language`/`filter`/`fontMap` props on every commit.
 * `onFontDescChanged` observes the button's `fontDesc` property through the
 * generic notify path, skipping `null` transitions.
 *
 * @typeParam P - The component prop shape.
 * @param Element - The font-dialog-button host intrinsic to render.
 * @returns A component that manages the button's dialog.
 */
export const withFontDialog = <P extends FontDialogHostProps>(Element: ElementType): ((props: P) => ReactNode) => {
    return (props: P): ReactNode => {
        const { title, modal, language, filter, fontMap, onFontDescChanged, ...rest } = props;
        const dialogRef = useRef<Gtk.FontDialog | null>(null);
        dialogRef.current ??= new Gtk.FontDialog();
        const dialog = dialogRef.current;

        useLayoutEffect(() => {
            dialog.setTitle(title ?? "");
            dialog.setModal(modal ?? true);
            if (language) dialog.setLanguage(language);
            dialog.setFilter(filter ?? null);
            dialog.setFontMap(fontMap ?? null);
        });

        return createElement(Element, {
            ...rest,
            dialog,
            onNotifyFontDesc: onFontDescChanged
                ? (fontDesc: Pango.FontDescription | null) => {
                      if (fontDesc) onFontDescChanged(fontDesc);
                  }
                : undefined,
        });
    };
};
