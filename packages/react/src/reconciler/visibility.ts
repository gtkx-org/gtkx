import * as Gtk from "@gtkx/gi/gtk";
import { scheduleLabelTextRebuild } from "./label-text-rebuild.js";
import { type Node, stateOf } from "./state.js";
import { scheduleTextBufferSync } from "./text-buffer-content-manager.js";
import { isBufferContentNode } from "./text-node-predicates.js";

const widgetOf = (node: Node): Gtk.Widget | null => {
    if (node instanceof Gtk.Widget) return node;
    const adopted = stateOf(node).adoptedInstance;
    return adopted instanceof Gtk.Widget ? adopted : null;
};

export const hideNode = (node: Node): void => {
    const state = stateOf(node);
    if (state.hidden) return;
    state.hidden = true;
    if (isBufferContentNode(node)) scheduleTextBufferSync(node);
    const widget = widgetOf(node);
    if (!widget) return;
    state.visibleWhenShown = widget.getVisible();
    widget.setVisible(false);
};

export const unhideNode = (node: Node): void => {
    const state = stateOf(node);
    if (!state.hidden) return;
    state.hidden = false;
    if (isBufferContentNode(node)) scheduleTextBufferSync(node);
    const widget = widgetOf(node);
    if (!widget) return;
    widget.setVisible(state.visibleWhenShown ?? true);
    state.visibleWhenShown = undefined;
};

export const reassertHidden = (node: Node): void => {
    const state = stateOf(node);
    if (!state.hidden) return;
    const widget = widgetOf(node);
    if (!widget?.getVisible()) return;
    state.visibleWhenShown = true;
    widget.setVisible(false);
};

const scheduleTextNodeRebuild = (node: Node): void => {
    if (isBufferContentNode(node)) scheduleTextBufferSync(node);
    else scheduleLabelTextRebuild(node);
};

export const setTextNodeHidden = (node: Node, hidden: boolean): void => {
    const state = stateOf(node);
    if ((state.hidden ?? false) === hidden) return;
    state.hidden = hidden;
    scheduleTextNodeRebuild(node);
};
