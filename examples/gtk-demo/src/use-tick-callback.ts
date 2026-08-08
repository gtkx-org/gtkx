import type * as Gdk from "@gtkx/gi/gdk";
import type * as GLib from "@gtkx/gi/glib";
import type * as Gtk from "@gtkx/gi/gtk";
import { type RefObject, useEffectEvent, useLayoutEffect, useRef } from "react";

type SourceResult = typeof GLib.SOURCE_CONTINUE | typeof GLib.SOURCE_REMOVE;
type TickHandler = (widget: Gtk.Widget, frameClock: Gdk.FrameClock) => SourceResult;

type TickRegistration = {
    widget: Gtk.Widget;
    id: number | null;
};

type TickRegistrationRef = RefObject<TickRegistration | null>;

function dropRegistration(registrationRef: TickRegistrationRef): void {
    const registration = registrationRef.current;

    if (registration === null) {
        return;
    }

    if (registration.id !== null) {
        registration.widget.removeTickCallback(registration.id);
    }

    registrationRef.current = null;
}

function forgetRegistration(registrationRef: TickRegistrationRef, entry: TickRegistration): void {
    entry.id = null;

    if (registrationRef.current === entry) {
        registrationRef.current = null;
    }
}

function addRegistration(
    registrationRef: TickRegistrationRef,
    widget: Gtk.Widget,
    tick: TickHandler,
): void {
    const entry: TickRegistration = { widget, id: null };

    entry.id = widget.addTickCallback((tickWidget, frameClock) => {
        const isKeep = tick(tickWidget, frameClock);

        if (!isKeep) {
            forgetRegistration(registrationRef, entry);
        }

        return isKeep;
    });

    registrationRef.current = entry;
}

function syncRegistration(
    registrationRef: TickRegistrationRef,
    target: RefObject<Gtk.Widget | null> | null,
    tick: TickHandler,
): void {
    const widget = target?.current ?? null;
    const registration = registrationRef.current;

    if (registration !== null && widget !== null && registration.widget === widget) {
        return;
    }

    dropRegistration(registrationRef);

    if (widget === null) {
        return;
    }

    addRegistration(registrationRef, widget, tick);
}

function useTickCallback(target: RefObject<Gtk.Widget | null> | null, callback: TickHandler): void {
    const tick = useEffectEvent(callback);
    const registrationRef = useRef<TickRegistration | null>(null);

    useLayoutEffect(() => {
        syncRegistration(registrationRef, target, (tickWidget, frameClock) => tick(tickWidget, frameClock));
    });

    useLayoutEffect(() => () => {
        dropRegistration(registrationRef);
    }, []);
}

export { useTickCallback };
