import { getHandle } from "@gtkx/runtime";
import { deferFinalization } from "@gtkx/runtime/internal";
import { signalAddEmissionHook, signalLookup, typeClassRef } from "@gtkx/gi/gobject";
import { type Widget, Window } from "@gtkx/gi/gtk";
import { Breakpoint, BreakpointBin } from "../adw.js";

const deferBinsAround = (focus: Widget): void => {
    for (
        let bin = focus.getAncestor(BreakpointBin);
        bin !== null;
        bin = bin.getParent()?.getAncestor(BreakpointBin) ?? null
    ) {
        deferFinalization(getHandle(bin), getHandle(focus));
    }
};

const deferFocusedBins = (): boolean => {
    for (const window of Window.listToplevels()) {
        const focus = window instanceof Window ? window.getFocus() : null;

        if (focus !== null) {
            deferBinsAround(focus);
        }
    }

    return true;
};

/* libadwaita's breakpoint bins register a weak pointer on the focused widget at each breakpoint change but never
 * store or clear it, so a focused widget that outlives its bin writes into the freed bin when it is finalized.
 * Breakpoints apply and unapply during that change, so keep every bin holding a focus allocated until the focused
 * widget is finalized. Internal bins of windows and dialogs have no wrapper, hence the emission hooks.
 */
typeClassRef(Breakpoint);
for (const signal of ["apply", "unapply"]) {
    signalAddEmissionHook(signalLookup(signal, Breakpoint), 0, deferFocusedBins);
}
