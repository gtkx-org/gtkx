import * as Adw from "@gtkx/gi/adw";
import { createContext, type ReactNode, type RefObject, useContext, useMemo } from "react";

type ToastOverlayRef = RefObject<Adw.ToastOverlay | null>;

const ToastContext = createContext<ToastOverlayRef | null>(null);

const useOverlayRef = (): ToastOverlayRef => {
    const overlayRef = useContext(ToastContext);
    if (overlayRef === null) {
        throw new Error("useToast and useToastOverlay must be used within a ToastProvider");
    }
    return overlayRef;
};

/** Describes a toast raised through {@link useToast}. */
export type ToastOptions = {
    /** Text shown in the toast, read as Pango markup when {@link ToastOptions.useMarkup} is set. */
    title?: string | undefined;
    /** Label for an action button; omit for a toast without one. */
    buttonLabel?: string | undefined;
    /** Called when the action button is clicked. */
    onButtonClicked?: (() => void) | undefined;
    /** Called when the toast leaves the screen, for any reason. */
    onDismissed?: (() => void) | undefined;
    /** Seconds before the toast dismisses itself; 0 keeps it until dismissed. */
    timeout?: number | undefined;
    /** Whether the toast shows immediately or waits behind the current one. */
    priority?: Adw.ToastPriority | undefined;
    /** Whether {@link ToastOptions.title} is interpreted as Pango markup. */
    useMarkup?: boolean | undefined;
};

/** Imperative controls for individual toasts, returned by {@link useToast}. */
export type ToastController = {
    /** Builds a toast, shows it through the overlay, and returns it. */
    show: (options?: ToastOptions) => Adw.Toast;
    /** Dismisses a single toast, typically one returned by {@link ToastController.show}. */
    dismiss: (toast: Adw.Toast) => void;
};

/** Imperative controls for the overlay as a whole, returned by {@link useToastOverlay}. */
export type ToastOverlayController = {
    /** Dismisses the shown toast and every queued one. */
    dismissAll: () => void;
};

/** Props for {@link ToastProvider}. */
export type ToastProviderProps = {
    /** Ref also given to the `AdwToastOverlay` the toasts appear over. */
    overlayRef: RefObject<Adw.ToastOverlay | null>;
    children?: ReactNode | undefined;
};

/** Shares a toast overlay with the {@link useToast} and {@link useToastOverlay} hooks below it. */
export const ToastProvider = ({ overlayRef, children }: ToastProviderProps): ReactNode => (
    <ToastContext.Provider value={overlayRef}>{children}</ToastContext.Provider>
);

/** Returns controls for showing and dismissing individual toasts on the nearest {@link ToastProvider}'s overlay. */
export const useToast = (): ToastController => {
    const overlayRef = useOverlayRef();

    return useMemo<ToastController>(
        () => ({
            show: (options = {}) => {
                const toast = new Adw.Toast({
                    title: options.title,
                    buttonLabel: options.buttonLabel,
                    timeout: options.timeout,
                    priority: options.priority,
                    useMarkup: options.useMarkup,
                });
                if (options.onButtonClicked) toast.once("button-clicked", options.onButtonClicked);
                if (options.onDismissed) toast.once("dismissed", options.onDismissed);
                overlayRef.current?.addToast(toast);
                return toast;
            },
            dismiss: (toast) => {
                toast.dismiss();
            },
        }),
        [overlayRef],
    );
};

/** Returns controls for the nearest {@link ToastProvider}'s overlay as a whole. */
export const useToastOverlay = (): ToastOverlayController => {
    const overlayRef = useOverlayRef();

    return useMemo<ToastOverlayController>(
        () => ({
            dismissAll: () => {
                overlayRef.current?.dismissAll();
            },
        }),
        [overlayRef],
    );
};
