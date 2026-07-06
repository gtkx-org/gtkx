import type * as Adw from "@gtkx/gi/adw";
import { AdwAlertDialog, type AdwAlertDialogProps } from "@gtkx/jsx/adw";
import { useMergeRefs } from "@gtkx/react";
import { Children, isValidElement, type ReactNode, type Ref, useLayoutEffect, useRef } from "react";
import { createParentContext } from "./hooks/use-placed-child.js";

const { Context: AlertDialogContext, useParentRef: useAlertDialogRef } = createParentContext<Adw.AlertDialog>(
    "<AlertDialog.Response> must be a child of <AlertDialog>",
);

/**
 * Props for {@link AlertDialog}. Forwards every {@link Adw.AlertDialog} prop
 * (`heading`, `body`, …); declare the dialog's buttons as {@link AlertDialog.Response}
 * children, and present the dialog through its `ref`.
 */
export type AlertDialogProps = AdwAlertDialogProps & { ref?: Ref<Adw.AlertDialog | null> };

/**
 * Props for {@link AlertDialog.Response}. A dialog button identified by `id`
 * with a display `label`; `appearance` styles it (e.g. suggested/destructive)
 * and `enabled` toggles its sensitivity.
 */
export type AlertDialogResponseProps = {
    id: string;
    label: string;
    appearance?: Adw.ResponseAppearance | null | undefined;
    enabled?: boolean | null | undefined;
};

const AlertDialogResponse = ({ id, label, appearance, enabled }: AlertDialogResponseProps): ReactNode => {
    const dialogRef = useAlertDialogRef();
    useLayoutEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        dialog.addResponse(id, label);
        if (appearance != null) dialog.setResponseAppearance(id, appearance);
        if (enabled != null) dialog.setResponseEnabled(id, enabled);
        return () => dialogRef.current?.removeResponse(id);
    }, [dialogRef, id, label, appearance, enabled]);
    return null;
};

const isResponse = (node: ReactNode): boolean => isValidElement(node) && node.type === AlertDialogResponse;

/**
 * Declarative wrapper over {@link Adw.AlertDialog}. Renders the dialog and
 * registers each {@link AlertDialog.Response} child through `adw_alert_dialog_add_response`,
 * applying its `appearance`/`enabled` on top; any non-response child becomes the
 * dialog's extra content. Present the dialog imperatively through its `ref`.
 */
export const AlertDialog: ((props: AlertDialogProps) => ReactNode) & {
    Response: (props: AlertDialogResponseProps) => ReactNode;
} = Object.assign(
    ({ children, ref, ...rest }: AlertDialogProps): ReactNode => {
        const dialogRef = useRef<Adw.AlertDialog | null>(null);
        const mergedRef = useMergeRefs<Adw.AlertDialog>(ref, dialogRef);
        const items = Children.toArray(children);
        const responses = items.filter(isResponse);
        const content = items.filter((node) => !isResponse(node));
        return (
            <>
                <AdwAlertDialog {...rest} ref={mergedRef}>
                    {content}
                </AdwAlertDialog>
                <AlertDialogContext.Provider value={dialogRef}>{responses}</AlertDialogContext.Provider>
            </>
        );
    },
    { Response: AlertDialogResponse },
);
