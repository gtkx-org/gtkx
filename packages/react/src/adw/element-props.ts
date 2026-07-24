import type * as Adw from "@gtkx/gi/adw";
import type { ReactNode } from "react";

/** One response button on an `Adw.AlertDialog`. */
export type AlertDialogResponse = {
    id: string;
    label: string;
    appearance?: Adw.ResponseAppearance;
    enabled?: boolean;
};

export interface AdwAlertDialogElementProps {
    responses?: AlertDialogResponse[] | null | undefined;
}

export interface AdwPreferencesRowElementProps {
    prefix?: ReactNode | null | undefined;
    suffix?: ReactNode | null | undefined;
}

export interface AdwExpanderRowElementProps extends AdwPreferencesRowElementProps {
    rows?: ReactNode | null | undefined;
    actions?: ReactNode | null | undefined;
}

export interface AdwToolbarViewElementProps {
    topBar?: ReactNode | null | undefined;
    bottomBar?: ReactNode | null | undefined;
}

export interface AdwBreakpointsElementProps {
    breakpoints?: ReactNode | null | undefined;
}
