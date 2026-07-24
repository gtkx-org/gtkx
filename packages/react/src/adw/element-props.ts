import type * as Adw from "@gtkx/gi/adw";
import type { ReactNode } from "react";
import type { ChildrenElementProps } from "../reconciler/element-props.js";

/** One response button on an `Adw.AlertDialog`. */
export type AlertDialogResponse = {
    id: string;
    label: string;
    appearance?: Adw.ResponseAppearance;
    enabled?: boolean;
};

export interface AdwAlertDialogElementProps extends ChildrenElementProps {
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

export interface AdwToolbarViewElementProps extends ChildrenElementProps {
    topBar?: ReactNode | null | undefined;
    bottomBar?: ReactNode | null | undefined;
}

export interface AdwBreakpointsElementProps extends ChildrenElementProps {
    breakpoints?: ReactNode | null | undefined;
}
