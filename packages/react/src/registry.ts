import type { Node } from "./node.js";
import { AdjustableNode } from "./nodes/adjustable.js";
import { AlertDialogNode } from "./nodes/alert-dialog.js";
import { AnimationNode } from "./nodes/animation.js";
import { ApplicationNode } from "./nodes/application.js";
import { CalendarNode } from "./nodes/calendar.js";
import { ColorDialogButtonNode } from "./nodes/color-dialog-button.js";
import { ColumnViewColumnNode } from "./nodes/column-view-column.js";
import { ContainerSlotNode } from "./nodes/container-slot.js";
import { DialogNode } from "./nodes/dialog.js";
import { DrawingAreaNode } from "./nodes/drawing-area.js";
import { EventControllerNode } from "./nodes/event-controller.js";
import { FixedChildNode } from "./nodes/fixed-child.js";
import { FontDialogButtonNode } from "./nodes/font-dialog-button.js";
import { GridChildNode } from "./nodes/grid-child.js";
import { LevelBarNode } from "./nodes/level-bar.js";
import { ListNode } from "./nodes/list.js";
import { ListItemNode } from "./nodes/list-item-node.js";
import { MenuNode } from "./nodes/menu.js";
import { NavigationPageNode } from "./nodes/navigation-page.js";
import { NavigationViewNode } from "./nodes/navigation-view.js";
import { NotebookNode } from "./nodes/notebook.js";
import { NotebookPageNode } from "./nodes/notebook-page.js";
import { NotebookPageTabNode } from "./nodes/notebook-page-tab.js";
import { OverlayChildNode } from "./nodes/overlay-child.js";
import { PopoverMenuNode } from "./nodes/popover-menu.js";
import { ScaleNode } from "./nodes/scale.js";
import { ScrolledWindowNode } from "./nodes/scrolled-window.js";
import { SearchBarNode } from "./nodes/search-bar.js";
import { ShortcutNode } from "./nodes/shortcut.js";
import { SlotNode } from "./nodes/slot.js";
import { SourceViewNode } from "./nodes/source-view.js";
import { SpinRowNode } from "./nodes/spin-row.js";
import { StackNode } from "./nodes/stack.js";
import { StackPageNode } from "./nodes/stack-page.js";
import { SwitchRowNode } from "./nodes/switch-row.js";
import { TextAnchorNode } from "./nodes/text-anchor.js";
import { TextPaintableNode } from "./nodes/text-paintable.js";
import { TextSegmentNode } from "./nodes/text-segment.js";
import { TextTagNode } from "./nodes/text-tag.js";
import { TextViewNode } from "./nodes/text-view.js";
import { ToggleGroupNode } from "./nodes/toggle-group.js";
import { WebViewNode } from "./nodes/web-view.js";
import { WidgetNode } from "./nodes/widget.js";
import { WindowNode } from "./nodes/window.js";

/**
 * Constructor shape every reconciler node class satisfies: it is instantiable
 * as a {@link Node} and exposes the static `createContainer` factory.
 */
export type NodeClass = (new (
    // biome-ignore lint/suspicious/noExplicitAny: Registry entries require flexible typing for varied node constructors
    ...args: any[]
) => Node) & {
    // biome-ignore lint/suspicious/noExplicitAny: Registry entries require flexible typing for varied node constructors
    createContainer(...args: any[]): unknown;
};

/**
 * Maps a JSX intrinsic element to the reconciler node class that backs it.
 *
 * A key is either the name of a virtual element with no backing GLib type
 * (`"Slot"`, `"StackPage"`, …) or the GLib type name of a widget/object a node
 * specializes (`"GtkWindow"`, `"GtkEventController"`, …). {@link createNode}
 * resolves an element by walking its GLib type ancestry against this map, so an
 * entry keyed on a base type also matches every subtype — `"GtkWidget"` is the
 * catch-all, and `"GtkEventController"` matches every event controller.
 *
 * Keying by string keeps the registry independent of which FFI namespaces a
 * project generates: an entry for a namespace that was not generated simply
 * never matches.
 */
export const NODE_REGISTRY: ReadonlyMap<string, NodeClass> = new Map<string, NodeClass>([
    ["ContainerSlot", ContainerSlotNode],
    ["AdwTimedAnimation", AnimationNode],
    ["AdwSpringAnimation", AnimationNode],
    ["ColumnViewColumn", ColumnViewColumnNode],
    ["FixedChild", FixedChildNode],
    ["GridChild", GridChildNode],
    ["MenuItem", MenuNode],
    ["MenuSection", MenuNode],
    ["MenuSubmenu", MenuNode],
    ["NavigationPage", NavigationPageNode],
    ["NotebookPage", NotebookPageNode],
    ["NotebookPageTab", NotebookPageTabNode],
    ["OverlayChild", OverlayChildNode],
    ["Shortcut", ShortcutNode],
    ["Slot", SlotNode],
    ["StackPage", StackPageNode],
    ["TextAnchor", TextAnchorNode],
    ["TextPaintable", TextPaintableNode],
    ["TextSegment", TextSegmentNode],
    ["TextTag", TextTagNode],
    ["GtkApplication", ApplicationNode],
    ["GtkEventController", EventControllerNode],
    ["GtkSourceView", SourceViewNode],
    ["GtkTextView", TextViewNode],
    ["WebKitWebView", WebViewNode],
    ["AdwAlertDialog", AlertDialogNode],
    ["AdwDialog", DialogNode],
    ["GtkWindow", WindowNode],
    ["AdwSpinRow", SpinRowNode],
    ["AdwSwitchRow", SwitchRowNode],
    ["GtkScale", ScaleNode],
    ["GtkLevelBar", LevelBarNode],
    ["GtkScrolledWindow", ScrolledWindowNode],
    ["GtkCalendar", CalendarNode],
    ["GtkColorDialogButton", ColorDialogButtonNode],
    ["GtkFontDialogButton", FontDialogButtonNode],
    ["GtkDrawingArea", DrawingAreaNode],
    ["GtkSearchBar", SearchBarNode],
    ["AdwNavigationView", NavigationViewNode],
    ["AdwToggleGroup", ToggleGroupNode],
    ["GtkNotebook", NotebookNode],
    ["GtkStack", StackNode],
    ["AdwViewStack", StackNode],
    ["GtkListView", ListNode],
    ["GtkColumnView", ListNode],
    ["GtkGridView", ListNode],
    ["GtkDropDown", ListNode],
    ["AdwComboRow", ListNode],
    ["GtkPopoverMenu", PopoverMenuNode],
    ["GtkPopoverMenuBar", PopoverMenuNode],
    ["GtkMenuButton", PopoverMenuNode],
    ["GtkSpinButton", AdjustableNode],
    ["GtkScaleButton", AdjustableNode],
    ["GtkRange", AdjustableNode],
    ["GtkListItem", ListItemNode],
    ["GtkListHeader", ListItemNode],
    ["GtkWidget", WidgetNode],
]);
