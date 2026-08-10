import type * as Adw from "@gtkx/gi/adw";
import type { ReactNode } from "react";
import type { ChildrenProps } from "../prop-types.js";

/** One button in an `Adw.AlertDialog`'s `responses` prop. */
type AlertDialogResponse = {
    /** Name the dialog reports on `onResponse` when this button is chosen. */
    id: string;
    /** Text shown on the button. */
    label: string;
    /** Styling the button is given, such as suggested or destructive; defaults to the plain appearance. */
    appearance?: Adw.ResponseAppearance;
    /** Whether the button can be activated; defaults to true. */
    isEnabled?: boolean;
};

/** Props of an `Adw.AlertDialog` element. */
type AdwAlertDialogProps = {
    /** Buttons the dialog offers, added and removed as the list changes. */
    responses?: AlertDialogResponse[] | null | undefined;
    /**
     * Widget set as the dialog's extra child, shown below the `heading` and `body` and above the
     * response buttons, leaving the dialog's own chrome in place.
     */
    children?: ReactNode;
};

/** Props of an `Adw.PreferencesRow` element. */
type AdwPreferencesRowProps = {
    /** Widgets added at the start of the row, before its title. */
    prefix?: ReactNode | null | undefined;
    /** Widgets added at the end of the row. */
    suffix?: ReactNode | null | undefined;
};

/** Props of an `Adw.ExpanderRow` element. */
type AdwExpanderRowProps = {
    /** Widgets added to the area the row reveals when it expands. */
    rows?: ReactNode | null | undefined;
} & AdwPreferencesRowProps;

/** Props of an `Adw.ToolbarView` element, whose `children` is the content the bars surround. */
type AdwToolbarViewProps = {
    /** Widgets stacked above the content. */
    topBar?: ReactNode | null | undefined;
    /** Widgets stacked below the content. */
    bottomBar?: ReactNode | null | undefined;
} & ChildrenProps;

/** Props of an element that hosts breakpoints, such as `Adw.Window` or `Adw.BreakpointBin`. */
type AdwBreakpointsProps = {
    /** `Adw.Breakpoint` elements added to the element, each applying while its condition holds. */
    breakpoints?: ReactNode | null | undefined;
} & ChildrenProps;

/** Props of an `Adw.MultiLayoutView` element. */
type AdwMultiLayoutViewProps = {
    /** `Adw.Layout` elements added to the view, each holding the content it lays out. */
    layouts?: ReactNode | null | undefined;
    /**
     * Widget the view places in the `Adw.LayoutSlot` whose `id` is the prop name without its `Slot`
     * suffix, so `sidebarSlot` fills the slot with id `sidebar` in whichever layout is current.
     */
    [slot: `${string}Slot`]: ReactNode | null | undefined;
};

export {
    type AlertDialogResponse,
    type AdwAlertDialogProps,
    type AdwPreferencesRowProps,
    type AdwExpanderRowProps,
    type AdwToolbarViewProps,
    type AdwBreakpointsProps,
    type AdwMultiLayoutViewProps,
};
