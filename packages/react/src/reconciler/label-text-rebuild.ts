import * as Gtk from "@gtkx/gi/gtk";
import { scheduleFlush } from "./commit-flush.js";
import { closestInstance, type Node, stateOf } from "./state.js";
import { isLabelTextWrapper } from "./text-wrapper.js";

const rebuilds = new WeakMap<Node, () => void>();

const rebuildLabelText = (owner: Node): void => {
    if (!(owner instanceof Gtk.Label)) return;
    const state = stateOf(owner);
    const runs = state.children.filter(isLabelTextWrapper);
    if (state.props["label"] !== undefined) {
        if (runs.length === 0) return;
        throw new Error("<GtkLabel> cannot mix a `label` prop with text children; use one or the other");
    }
    const text = runs.map((run) => String(stateOf(run).props["text"])).join("");
    state.signalStore.blockAll();
    try {
        owner.setLabel(text);
    } finally {
        state.signalStore.unblockAll();
    }
};

export const scheduleLabelTextRebuild = (node: Node): void => {
    const owner = closestInstance(node, (candidate) => candidate instanceof Gtk.Label);
    if (!owner) return;
    let rebuild = rebuilds.get(owner);
    if (!rebuild) {
        rebuild = () => rebuildLabelText(owner);
        rebuilds.set(owner, rebuild);
    }
    scheduleFlush(rebuild);
};
