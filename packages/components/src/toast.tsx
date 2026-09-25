import type { ReactNode, RefObject } from "react";
import * as Adw from "@gtkx/gi/adw";
import { createContext, useContext, useMemo } from "react";
import type { ToastController, ToastOptions, ToastProviderProps } from "./types.js";

type OverlayRef = RefObject<Adw.ToastOverlay | null>;

const ToastContext = createContext<OverlayRef | null>(null);

const useOverlayRef = (): OverlayRef => {
    const overlayRef = useContext(ToastContext);

    if (overlayRef === null) {
        throw new Error("useToast must be used within a ToastProvider");
    }

    return overlayRef;
};

const buildToast = (options: ToastOptions): Adw.Toast => {
    const { onButtonClicked, onDismissed, ...props } = options;
    const toast = new Adw.Toast(props);

    if (onButtonClicked != null) {
        toast.on("button-clicked", () => {
            onButtonClicked(toast);
        });
    }

    if (onDismissed != null) {
        toast.on("dismissed", () => {
            onDismissed(toast);
        });
    }

    return toast;
};

/** Shares an Adw.ToastOverlay reference with useToast in every descendant. */
function ToastProvider(props: ToastProviderProps): ReactNode {
    return <ToastContext.Provider value={props.overlayRef}>{props.children}</ToastContext.Provider>;
}

/** Returns a {@link ToastController} that shows and dismisses toasts on the nearest provider's overlay. */
function useToast(): ToastController {
    const overlayRef = useOverlayRef();

    return useMemo<ToastController>(
        () => ({
            show: (options?: ToastOptions) => {
                const toast = buildToast(options ?? {});
                overlayRef.current?.addToast(toast);

                return toast;
            },
            dismissAll: () => {
                overlayRef.current?.dismissAll();
            },
        }),
        [overlayRef],
    );
}

export { ToastProvider, useToast };
