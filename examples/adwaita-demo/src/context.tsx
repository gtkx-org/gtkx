import type * as Adw from "@gtkx/gi/adw";
import { type ToastOptions, useToast } from "@gtkx/components";
import { createContext, type ReactNode, use, useRef } from "react";

type DemoContextValue = {
    toastOverlay: Adw.ToastOverlay | null;
    notify: (title: string) => void;
    showToast: (options: ToastOptions) => Adw.Toast;
    dismissToasts: () => void;
    devel: boolean;
    setDevel: (value: boolean) => void;
};

const DemoContext = createContext<DemoContextValue | null>(null);

type DemoProviderProps = Pick<DemoContextValue, "toastOverlay" | "devel" | "setDevel"> & {
    children: ReactNode;
};

const DemoProvider = ({ children, ...state }: DemoProviderProps) => {
    const toasts = useToast();
    const activeToasts = useRef(new Set<Adw.Toast>());

    const showToast = (options: ToastOptions) => {
        const toast = toasts.show({
            ...options,
            onDismissed: (dismissed) => {
                activeToasts.current.delete(dismissed);
                options.onDismissed?.(dismissed);
            },
        });
        activeToasts.current.add(toast);
        return toast;
    };

    const dismissToasts = () => {
        /* libadwaita 1.9.3 dismiss_all frees queued ToastInfo while its hide animation still
         * references it (src/adw-toast-overlay.c). Individual dismissals defer that cleanup. */
        for (const toast of [...activeToasts.current]) toast.dismiss();
    };

    return (
        <DemoContext value={{ ...state, showToast, dismissToasts, notify: (title) => showToast({ title }) }}>
            {children}
        </DemoContext>
    );
};

const useDemo = (): DemoContextValue => {
    const context = use(DemoContext);
    if (!context) {
        throw new Error("Demo pages require the application context");
    }
    return context;
};

export { DemoProvider, useDemo };
