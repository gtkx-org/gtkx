/**
 * Coalesced text synchronization for `<GtkLabel>` elements.
 *
 * Text nodes rendered inside a label become inert `LABEL_TEXT_KIND` wrappers;
 * this module concatenates a label's wrapper children in tree order and writes
 * the result to the backing `Gtk.Label`'s `label` property. The write is
 * scheduled through {@link "./commit-flush".scheduleFlush}, so any number
 * of text mutations within one commit collapse into a single property set, and
 * runs with the label's signal handlers blocked.
 */
import * as Gtk from "@gtkx/gi/gtk";
import { scheduleFlush } from "./commit-flush.js";
import { closestInstance, type Node, stateOf } from "./state.js";
import { isLabelTextWrapper } from "./text-wrapper.js";

const rebuilds = new WeakMap<Node, () => void>();

const rebuildLabelText = (owner: Node): void => {
    if (!(owner instanceof Gtk.Label)) return;
    const state = stateOf(owner);
    const runs = state.children.filter(isLabelTextWrapper);
    if (state.props.label !== undefined) {
        if (runs.length === 0) return;
        throw new Error("<GtkLabel> cannot mix a `label` prop with text children; use one or the other");
    }
    const text = runs.map((run) => String(stateOf(run).props.text)).join("");
    state.signalStore.blockAll();
    try {
        owner.setLabel(text);
    } finally {
        state.signalStore.unblockAll();
    }
};

/**
 * Walks up from `node` to the enclosing label element and schedules a single
 * end-of-commit rebuild of its text content. Used by the reconciler whenever a
 * label-text wrapper is attached, detached, or updated.
 *
 * @param node - The node whose label text content changed.
 */
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
