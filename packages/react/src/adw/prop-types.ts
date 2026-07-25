import type * as Adw from "@gtkx/gi/adw";
import type { ReactNode } from "react";
import type { ChildrenProps, GtkHeaderBarProps } from "../reconciler/prop-types.js";

/** One response button on an `Adw.AlertDialog`. */
export type AlertDialogResponse = {
    id: string;
    label: string;
    appearance?: Adw.ResponseAppearance;
    enabled?: boolean;
};

export interface AdwAlertDialogProps extends ChildrenProps {
    responses?: AlertDialogResponse[] | null | undefined;
}

export interface AdwPreferencesRowProps {
    prefix?: ReactNode | null | undefined;
    suffix?: ReactNode | null | undefined;
}

export interface AdwExpanderRowProps extends AdwPreferencesRowProps {
    rows?: ReactNode | null | undefined;
    actions?: ReactNode | null | undefined;
}

export interface AdwToolbarViewProps extends ChildrenProps {
    topBar?: ReactNode | null | undefined;
    bottomBar?: ReactNode | null | undefined;
}

export interface AdwBreakpointsProps extends ChildrenProps {
    breakpoints?: ReactNode | null | undefined;
}

export type AdwHeaderBarProps = GtkHeaderBarProps;
export type AdwActionRowProps = AdwPreferencesRowProps;
export type AdwEntryRowProps = AdwPreferencesRowProps;
export type AdwApplicationWindowProps = AdwBreakpointsProps;
export type AdwWindowProps = AdwBreakpointsProps;
export type AdwDialogProps = AdwBreakpointsProps;
export type AdwBreakpointBinProps = AdwBreakpointsProps;

export type AdwBinProps = ChildrenProps;
export type AdwBottomSheetProps = ChildrenProps;
export type AdwCarouselProps = ChildrenProps;
export type AdwClampProps = ChildrenProps;
export type AdwClampScrollableProps = ChildrenProps;
export type AdwFlapProps = ChildrenProps;
export type AdwLeafletProps = ChildrenProps;
export type AdwNavigationPageProps = ChildrenProps;
export type AdwNavigationSplitViewProps = ChildrenProps;
export type AdwNavigationViewProps = ChildrenProps;
export type AdwOverlaySplitViewProps = ChildrenProps;
export type AdwPreferencesDialogProps = ChildrenProps;
export type AdwPreferencesGroupProps = ChildrenProps;
export type AdwPreferencesPageProps = ChildrenProps;
export type AdwPreferencesWindowProps = ChildrenProps;
export type AdwShortcutsDialogProps = ChildrenProps;
export type AdwShortcutsSectionProps = ChildrenProps;
export type AdwSplitButtonProps = ChildrenProps;
export type AdwSqueezerProps = ChildrenProps;
export type AdwStatusPageProps = ChildrenProps;
export type AdwTabOverviewProps = ChildrenProps;
export type AdwTabViewProps = ChildrenProps;
export type AdwToastOverlayProps = ChildrenProps;
export type AdwToggleProps = ChildrenProps;
export type AdwToggleGroupProps = ChildrenProps;
export type AdwViewStackProps = ChildrenProps;
export type AdwWrapBoxProps = ChildrenProps;
