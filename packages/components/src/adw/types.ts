import type * as Adw from "@gtkx/gi/adw";
import type { ReactNode, RefObject } from "react";

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
