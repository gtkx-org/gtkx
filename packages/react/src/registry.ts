import * as Adw from "@gtkx/ffi/adw";
import * as Gtk from "@gtkx/ffi/gtk";
import * as GtkSource from "@gtkx/ffi/gtksource";
import * as Vte from "@gtkx/ffi/vte";
import * as WebKit from "@gtkx/ffi/webkit";
import type { Node } from "./node.js";
import { ActionRowPrefixNode, ActionRowSuffixNode } from "./nodes/action-row-child.js";
import { AdjustableNode } from "./nodes/adjustable.js";
import { AlertDialogResponseNode } from "./nodes/alert-dialog-response.js";
import { AnimationNode } from "./nodes/animation.js";
import { ApplicationNode } from "./nodes/application.js";
import { AutowrappedNode } from "./nodes/autowrapped.js";
import { CalendarNode } from "./nodes/calendar.js";
import { ColorDialogButtonNode } from "./nodes/color-dialog-button.js";
import { ColumnViewNode } from "./nodes/column-view.js";
import { ColumnViewColumnNode } from "./nodes/column-view-column.js";
import { DialogNode } from "./nodes/dialog.js";
import { DrawingAreaNode } from "./nodes/drawing-area.js";
import { EventControllerNode } from "./nodes/event-controller.js";
import { ExpanderRowActionNode, ExpanderRowRowNode } from "./nodes/expander-row-child.js";
import { FixedChildNode } from "./nodes/fixed-child.js";
import { FontDialogButtonNode } from "./nodes/font-dialog-button.js";
import { GridNode } from "./nodes/grid.js";
import { GridChildNode } from "./nodes/grid-child.js";
import { LevelBarNode } from "./nodes/level-bar.js";
import { ListItemNode } from "./nodes/list-item.js";
import { ListViewNode } from "./nodes/list-view.js";
import { MenuNode } from "./nodes/menu.js";
import { NavigationPageNode } from "./nodes/navigation-page.js";
import { NavigationViewNode } from "./nodes/navigation-view.js";
import { NotebookNode } from "./nodes/notebook.js";
import { NotebookPageNode } from "./nodes/notebook-page.js";
import { NotebookPageTabNode } from "./nodes/notebook-page-tab.js";
import { OverlayChildNode } from "./nodes/overlay-child.js";
import { PackEndNode, PackStartNode } from "./nodes/pack-child.js";
import { PopoverMenuNode } from "./nodes/popover-menu.js";
import { ScaleNode } from "./nodes/scale.js";
import { ScrolledWindowNode } from "./nodes/scrolled-window.js";
import { SearchBarNode } from "./nodes/search-bar.js";
import { ShortcutNode } from "./nodes/shortcut.js";
import { ShortcutControllerNode } from "./nodes/shortcut-controller.js";
import { SimpleListItemNode } from "./nodes/simple-list-item.js";
import { SimpleListViewNode } from "./nodes/simple-list-view.js";
import { SlotNode } from "./nodes/slot.js";
import { SourceViewNode } from "./nodes/source-view.js";
import { StackNode } from "./nodes/stack.js";
import { StackPageNode } from "./nodes/stack-page.js";
import { TextAnchorNode } from "./nodes/text-anchor.js";
import { TextPaintableNode } from "./nodes/text-paintable.js";
import { TextSegmentNode } from "./nodes/text-segment.js";
import { TextTagNode } from "./nodes/text-tag.js";
import { TextViewNode } from "./nodes/text-view.js";
import { ToggleNode } from "./nodes/toggle.js";
import { ToggleGroupNode } from "./nodes/toggle-group.js";
import { ToolbarBottomNode, ToolbarTopNode } from "./nodes/toolbar-child.js";
import { TreeListItemNode } from "./nodes/tree-list-item.js";
import { TreeListViewNode } from "./nodes/tree-list-view.js";
import { WebViewNode } from "./nodes/web-view.js";
import { WidgetNode } from "./nodes/widget.js";
import { WindowNode } from "./nodes/window.js";

// biome-ignore lint/suspicious/noExplicitAny: Registry entries require flexible typing for varied node constructors
export type NodeClass = (new (...args: any[]) => Node) & { createContainer(...args: any[]): unknown };

// biome-ignore lint/suspicious/noExplicitAny: Class keys require flexible typing for GTK class hierarchy matching
type ClassKey = abstract new (...args: any[]) => any;

type RegistryKey = string | ClassKey | (string | ClassKey)[];

type NodeRegistryEntry = [RegistryKey, NodeClass];

export const NODE_REGISTRY: NodeRegistryEntry[] = [
    ["ActionRowPrefix", ActionRowPrefixNode],
    ["ActionRowSuffix", ActionRowSuffixNode],
    ["AlertDialogResponse", AlertDialogResponseNode],
    ["Animation", AnimationNode],
    ["ColumnViewColumn", ColumnViewColumnNode],
    ["ExpanderRowRow", ExpanderRowRowNode],
    ["ExpanderRowAction", ExpanderRowActionNode],
    ["FixedChild", FixedChildNode],
    ["GridChild", GridChildNode],
    ["ListItem", ListItemNode],
    [["MenuItem", "MenuSection", "MenuSubmenu"], MenuNode],
    ["NavigationPage", NavigationPageNode],
    ["NotebookPage", NotebookPageNode],
    ["NotebookPageTab", NotebookPageTabNode],
    ["OverlayChild", OverlayChildNode],
    ["PackStart", PackStartNode],
    ["PackEnd", PackEndNode],
    ["Shortcut", ShortcutNode],
    ["SimpleListItem", SimpleListItemNode],
    ["Slot", SlotNode],
    ["StackPage", StackPageNode],
    ["TextAnchor", TextAnchorNode],
    ["TextPaintable", TextPaintableNode],
    ["TextSegment", TextSegmentNode],
    ["TextTag", TextTagNode],
    ["Toggle", ToggleNode],
    ["ToolbarTop", ToolbarTopNode],
    ["ToolbarBottom", ToolbarBottomNode],
    ["TreeListItem", TreeListItemNode],
    ["TreeListView", TreeListViewNode],

    [Gtk.Application, ApplicationNode],
    [Gtk.ShortcutController, ShortcutControllerNode],
    [Gtk.EventController, EventControllerNode],
    [GtkSource.View, SourceViewNode],
    [Gtk.TextView, TextViewNode],
    [WebKit.WebView, WebViewNode],
    [Adw.Dialog, DialogNode],
    [Gtk.Window, WindowNode],
    [Gtk.Scale, ScaleNode],
    [Gtk.LevelBar, LevelBarNode],
    [Gtk.ScrolledWindow, ScrolledWindowNode],
    [Gtk.Calendar, CalendarNode],
    [Gtk.ColorDialogButton, ColorDialogButtonNode],
    [Gtk.FontDialogButton, FontDialogButtonNode],
    [Gtk.DrawingArea, DrawingAreaNode],
    [Gtk.SearchBar, SearchBarNode],
    [Gtk.Grid, GridNode],
    [Adw.NavigationView, NavigationViewNode],
    [Adw.ToggleGroup, ToggleGroupNode],
    [Gtk.Notebook, NotebookNode],
    [[Gtk.Stack, Adw.ViewStack], StackNode],
    [Gtk.ColumnView, ColumnViewNode],
    [[Gtk.ListView, Gtk.GridView], ListViewNode],
    [[Gtk.DropDown, Adw.ComboRow], SimpleListViewNode],
    [[Gtk.ListBox, Gtk.FlowBox], AutowrappedNode],
    [[Gtk.PopoverMenu, Gtk.PopoverMenuBar, Gtk.MenuButton], PopoverMenuNode],
    [[Gtk.Scrollbar, Gtk.SpinButton, Vte.Terminal], AdjustableNode],
    [Gtk.Widget, WidgetNode],
];
