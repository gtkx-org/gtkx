import type * as Adw from "@gtkx/gi/adw";
import type { AdwToastProps } from "@gtkx/jsx/adw";
import type { ReactNode, RefObject } from "react";

/**
 * Describes a toast raised through {@link useToast}: the construct-time properties of an
 * `Adw.Toast` plus its `button-clicked` and `dismissed` handlers.
 */
type ToastOptions = Adw.ToastConstructorProps & Pick<AdwToastProps, "onButtonClicked" | "onDismissed">;

/** Imperative controls for individual toasts, returned by {@link useToast}. */
type ToastController = {
    /** Builds a toast, shows it through the overlay, and returns it. */
    show: (options?: ToastOptions) => Adw.Toast;
    /** Dismisses a single toast, typically one returned by {@link ToastController.show}. */
    dismiss: (toast: Adw.Toast) => void;
};

/** Imperative controls for the overlay as a whole, returned by {@link useToastOverlay}. */
type ToastOverlayController = {
    /** Dismisses the shown toast and every queued one. */
    dismissAll: () => void;
};

/** Props for {@link ToastProvider}. */
type ToastProviderProps = {
    /** Ref also given to the `AdwToastOverlay` the toasts appear over. */
    overlayRef: RefObject<Adw.ToastOverlay | null>;
    children?: ReactNode | undefined;
};

export { type ToastOptions, type ToastController, type ToastOverlayController, type ToastProviderProps };
