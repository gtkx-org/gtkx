import type * as Adw from "@gtkx/gi/adw";
import { AdwAlertDialog, type AdwAlertDialogProps } from "@gtkx/jsx/adw";
import { useMergeRefs } from "@gtkx/react";
import { Children, isValidElement, type ReactNode, type Ref, useLayoutEffect, useRef } from "react";
import { createParentContext } from "./hooks/use-placed-child.js";

const { Context: AlertDialogContext, useParentRef: useAlertDialogRef } = createParentContext<Adw.AlertDialog>(
    "<AlertDialog.Response> must be a child of <AlertDialog>",
);

export type AlertDialogProps = AdwAlertDialogProps & { ref?: Ref<Adw.AlertDialog | null> };

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
