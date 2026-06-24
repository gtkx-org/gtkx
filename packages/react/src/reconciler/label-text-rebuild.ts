import * as Gtk from "@gtkx/gi/gtk";
import { scheduleHostRebuild } from "./host-rebuild.js";
import { type Node, stateOf } from "./state.js";
import { isLabelTextWrapper } from "./text-wrapper.js";

const rebuildLabelText = (host: Node): void => {
    if (!(host instanceof Gtk.Label)) return;
    const state = stateOf(host);
    const runs = state.children.filter(isLabelTextWrapper);
    if (state.props["label"] !== undefined) {
        if (runs.length === 0) return;
        throw new Error("<GtkLabel> cannot mix a `label` prop with text children; use one or the other");
    }
    const text = runs.map((run) => String(stateOf(run).props["text"])).join("");
    state.signalStore.blockAll();
    try {
        host.setLabel(text);
    } finally {
        state.signalStore.unblockAll();
    }
};

export const scheduleLabelTextRebuild = (node: Node): void => {
    scheduleHostRebuild(
        node,
        (candidate) => candidate instanceof Gtk.Label,
        (host) => () => rebuildLabelText(host),
    );
};
