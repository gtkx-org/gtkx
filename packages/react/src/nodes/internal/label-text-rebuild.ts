/**
 * Coalesced text synchronization for `<GtkLabel>` elements.
 *
 * Text nodes rendered inside a label become inert `LABEL_TEXT_KIND` wrappers;
 * this module concatenates a label's wrapper children in tree order and writes
 * the result to the backing `Gtk.Label`'s `label` property. The write is
 * scheduled through {@link "../../commit-flush".scheduleFlush}, so any number
 * of text mutations within one commit collapse into a single property set, and
 * runs with the label's signal handlers blocked.
 */
import * as Gtk from "@gtkx/gi/gtk";
import { scheduleFlush } from "../../commit-flush.js";
import { closestInstance, type Instance } from "../../instance.js";
import { isLabelTextWrapper } from "./text-wrapper.js";

const rebuilds = new WeakMap<Instance, () => void>();

const rebuildLabelText = (owner: Instance): void => {
    const label = owner.backingInstance;
    if (!(label instanceof Gtk.Label)) return;
    const runs = owner.children.filter(isLabelTextWrapper);
    if (owner.props.label !== undefined) {
        if (runs.length === 0) return;
        throw new Error("<GtkLabel> cannot mix a `label` prop with text children; use one or the other");
    }
    const text = runs.map((run) => String(run.props.text)).join("");
    owner.signalStore.blockAll();
    try {
        label.setLabel(text);
    } finally {
        owner.signalStore.unblockAll();
    }
};

/**
 * Walks up from `node` to the enclosing label element and schedules a single
 * end-of-commit rebuild of its text content. Used by the reconciler whenever a
 * label-text wrapper is attached, detached, or updated.
 *
 * @param node - The instance whose label text content changed.
 */
export const scheduleLabelTextRebuild = (node: Instance): void => {
    const owner = closestInstance(node, (instance) => instance.backingInstance instanceof Gtk.Label);
    if (!owner) return;
    let rebuild = rebuilds.get(owner);
    if (!rebuild) {
        rebuild = () => rebuildLabelText(owner);
        rebuilds.set(owner, rebuild);
    }
    scheduleFlush(rebuild);
};
