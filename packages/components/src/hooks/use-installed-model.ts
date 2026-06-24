import type * as Gtk from "@gtkx/gi/gtk";
import { useTargetRegistration } from "@gtkx/react/internal";
import { type RefObject, useRef } from "react";

/**
 * Installs `model` onto the realized GTK widget referenced by `target` through
 * the `install` callback, re-running whenever the widget or model identity
 * changes and tolerating the widget being realized after mount.
 */
export const useInstalledModel = <W extends Gtk.Widget, M>(
    target: RefObject<W | null>,
    model: M,
    install: (widget: W, model: M) => void,
): void => {
    const installRef = useRef(install);
    installRef.current = install;
    useTargetRegistration<W, { widget: W; model: M }>(target, {
        attach: (widget) => {
            installRef.current(widget, model);
            return { widget, model };
        },
        detach: () => {},
        isSame: (registration, widget) => registration.widget === widget && registration.model === model,
    });
};
