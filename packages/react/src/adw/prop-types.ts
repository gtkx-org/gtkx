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

export {
    type AlertDialogResponse,
    type AdwAlertDialogProps,
    type AdwPreferencesRowProps,
    type AdwExpanderRowProps,
    type AdwToolbarViewProps,
    type AdwBreakpointsProps,
};
