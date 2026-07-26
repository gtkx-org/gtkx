import type * as Adw from "@gtkx/gi/adw";
import type { ReactNode } from "react";
import type { ChildrenProps } from "../prop-types.js";

export type AlertDialogResponse = {
    id: string;
    label: string;
    appearance?: Adw.ResponseAppearance;
    enabled?: boolean;
};

export type AdwAlertDialogProps = {
    responses?: AlertDialogResponse[] | null | undefined;
} & ChildrenProps;

export type AdwPreferencesRowProps = {
    prefix?: ReactNode | null | undefined;
    suffix?: ReactNode | null | undefined;
};

export type AdwExpanderRowProps = {
    rows?: ReactNode | null | undefined;
    actions?: ReactNode | null | undefined;
} & AdwPreferencesRowProps;

export type AdwToolbarViewProps = {
    topBar?: ReactNode | null | undefined;
    bottomBar?: ReactNode | null | undefined;
} & ChildrenProps;

export type AdwBreakpointsProps = {
    breakpoints?: ReactNode | null | undefined;
} & ChildrenProps;
