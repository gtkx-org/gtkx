import * as Adw from "@gtkx/gi/adw";
import { type ElementType, type ReactNode, useCallback } from "react";
import { useDismissalWatch, useRefusedCloseWarning } from "../hooks/use-dismissal.js";
import { useParentWindow } from "../hooks/use-parent-window.js";
import { createPresentedComponent, type PresentedProps } from "../hooks/use-presented-instance.js";
import type { Props } from "../reconciler/registry.js";
import { applyMutation } from "../reconciler/signals.js";
import { describeElement, typeNameOf } from "../utils/dismissal.js";
import { createPortaledComponent } from "./portaled.js";

type DialogComponentProps = PresentedProps<Adw.Dialog>;

const closeDialog = (dialog: Adw.Dialog): void => {
    applyMutation(() => {
        dialog.forceClose();
    });
};

const usePresentDialog = (): ((dialog: Adw.Dialog) => void) => {
    const parent = useParentWindow();

    return useCallback(
        (dialog: Adw.Dialog) => {
            dialog.present(parent);
        },
        [parent],
    );
};

const CLOSE_ANSWERS = ["onClosed", "onCloseAttempt", "onResponse"];

const refusedCloseMessage = (dialog: Adw.Dialog, props: Props): string => {
    const handlers = dialog instanceof Adw.AlertDialog ? "onClosed or onResponse" : "onClosed";

    return (
        `${describeElement(dialog, props)} was asked to close (its close button or Escape), but nothing handles ` +
        `${handlers}, so it stays open. Stop rendering it from onClosed, or set canClose={false} and handle ` +
        "onCloseAttempt."
    );
};

const useDialogCloseRequests = (dialog: Adw.Dialog | null, props: Props): Props => {
    const isAnswered = CLOSE_ANSWERS.some((name) => typeof props[name] === "function");
    const isAllowed = props.canClose !== false;
    const key = dialog === null ? "" : typeNameOf(dialog);

    useRefusedCloseWarning(dialog, isAllowed && !isAnswered, `${key}:close-attempt`, () =>
        dialog === null ? "" : refusedCloseMessage(dialog, props),
    );
    const parent = useParentWindow();

    useDismissalWatch(dialog, "closed", `${key}:closed`, () =>
        dialog === null || parent?.getVisible() === false
            ? null
            : `${describeElement(dialog, props)} closed, but the app still renders it, so it cannot be shown again ` +
              "until the app stops rendering it. Stop rendering it from onClosed.",
    );

    return { ...props, canClose: isAllowed && isAnswered };
};

const createDialogComponent = (Component: ElementType): ((props: DialogComponentProps) => ReactNode) =>
    createPortaledComponent(
        createPresentedComponent<Adw.Dialog>(Component, {
            usePresent: usePresentDialog,
            dismiss: closeDialog,
            useNativeProps: useDialogCloseRequests,
        }),
    );

/** @internal */
export { createDialogComponent };
