import * as Gtk from "@gtkx/gi/gtk";
import { scheduleContentRebuild } from "./content-rebuild.js";
import { type Node, stateOf } from "./state.js";
import { isLabelTextNode } from "./text-node.js";

const rebuildLabelText = (owner: Gtk.Label): void => {
    const state = stateOf(owner);
    const runs = state.children.filter(isLabelTextNode);
    if (state.props.label !== undefined) {
        if (runs.length === 0) return;
        throw new Error("<GtkLabel> cannot mix a `label` prop with text children; use one or the other");
    }
    const text = runs.map((run) => String(stateOf(run).props.text)).join("");
    owner.setLabel(text);
};

export const scheduleLabelTextRebuild = (node: Node): void => {
    scheduleContentRebuild(
        node,
        (candidate): candidate is Gtk.Label => candidate instanceof Gtk.Label,
        (owner) => () => rebuildLabelText(owner),
    );
};
