import type * as Adw from "@gtkx/gi/adw";
import type { ReactNode } from "react";
import type { ChildrenProps } from "../prop-types.js";

type AlertDialogResponse = {
    id: string;
    label: string;
    appearance?: Adw.ResponseAppearance;
    isEnabled?: boolean;
};

type AdwAlertDialogProps = {
    responses?: AlertDialogResponse[] | null | undefined;
} & ChildrenProps;

type AdwPreferencesRowProps = {
    prefix?: ReactNode | null | undefined;
    suffix?: ReactNode | null | undefined;
};

type AdwExpanderRowProps = {
    rows?: ReactNode | null | undefined;
    actions?: ReactNode | null | undefined;
} & AdwPreferencesRowProps;

type AdwToolbarViewProps = {
    topBar?: ReactNode | null | undefined;
    bottomBar?: ReactNode | null | undefined;
} & ChildrenProps;

type AdwBreakpointsProps = {
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
