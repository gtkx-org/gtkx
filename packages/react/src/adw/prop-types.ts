import type * as Adw from "@gtkx/gi/adw";
import type { ReactNode } from "react";
import type { ChildrenProps } from "../reconciler/prop-types.js";

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
