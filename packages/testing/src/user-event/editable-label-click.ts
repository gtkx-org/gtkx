import * as Gtk from "@gtkx/gi/gtk";

const START_EDITING_ACTION = "editing.start";

const editableLabelFor = (widget: Gtk.Widget): Gtk.EditableLabel | null => {
    const owner = widget instanceof Gtk.Label ? widget.getParent()?.getParent() : widget;

    return owner instanceof Gtk.EditableLabel && !owner.getEditing() ? owner : null;
};

const isEditableLabelText = (widget: Gtk.Widget): boolean => editableLabelFor(widget) !== null;

const applyEditableLabelClick = (widget: Gtk.Widget): void => {
    editableLabelFor(widget)?.activateAction(START_EDITING_ACTION, null);
};

export { applyEditableLabelClick, isEditableLabelText };
