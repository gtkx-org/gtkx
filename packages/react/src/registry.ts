import * as Adw from "@gtkx/ffi/adw";
import * as Gtk from "@gtkx/ffi/gtk";
import * as GtkSource from "@gtkx/ffi/gtksource";
import * as WebKit from "@gtkx/ffi/webkit";
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
import { SpinRowNode } from "./nodes/spin-row.js";
import { SourceViewNode } from "./nodes/source-view.js";
import { StackNode } from "./nodes/stack.js";
import { StackPageNode } from "./nodes/stack-page.js";
import { TextAnchorNode } from "./nodes/text-anchor.js";
import { TextPaintableNode } from "./nodes/text-paintable.js";
import { TextSegmentNode } from "./nodes/text-segment.js";
import { TextTagNode } from "./nodes/text-tag.js";
import { TextViewNode } from "./nodes/text-view.js";
import { ToggleGroupNode } from "./nodes/toggle-group.js";
import { WebViewNode } from "./nodes/web-view.js";
import { WidgetNode } from "./nodes/widget.js";
import { WindowNode } from "./nodes/window.js";

export const AdjustableWidgets = [Gtk.SpinButton, Gtk.ScaleButton, Gtk.Range] as const;
export type AdjustableWidget = InstanceType<(typeof AdjustableWidgets)[number]>;

export const StackWidgets = [Gtk.Stack, Adw.ViewStack] as const;
export type StackWidget = InstanceType<(typeof StackWidgets)[number]>;

export const PopoverMenuWidgets = [Gtk.PopoverMenu, Gtk.PopoverMenuBar, Gtk.MenuButton] as const;
export type PopoverMenuWidget = InstanceType<(typeof PopoverMenuWidgets)[number]>;

export type NodeClass = (new (
    // biome-ignore lint/suspicious/noExplicitAny: Registry entries require flexible typing for varied node constructors
    ...args: any[]
) => Node) & {
    // biome-ignore lint/suspicious/noExplicitAny: Registry entries require flexible typing for varied node constructors
    createContainer(...args: any[]): unknown;
};

// biome-ignore lint/suspicious/noExplicitAny: Class keys require flexible typing for GTK class hierarchy matching
type ClassKey = new (...args: any[]) => any;
type RegistryKey = string | ClassKey | readonly (string | ClassKey)[];
type NodeRegistryEntry = [RegistryKey, NodeClass];

export const NODE_REGISTRY: NodeRegistryEntry[] = [
    ["ContainerSlot", ContainerSlotNode],
    [["AdwTimedAnimation", "AdwSpringAnimation"], AnimationNode],
    ["ColumnViewColumn", ColumnViewColumnNode],
    ["FixedChild", FixedChildNode],
    ["GridChild", GridChildNode],
    [["MenuItem", "MenuSection", "MenuSubmenu"], MenuNode],
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
    [Gtk.Application, ApplicationNode],
    [Gtk.EventController, EventControllerNode],
    [GtkSource.View, SourceViewNode],
    [Gtk.TextView, TextViewNode],
    [WebKit.WebView, WebViewNode],
    [Adw.AlertDialog, AlertDialogNode],
    [Adw.Dialog, DialogNode],
    [Gtk.Window, WindowNode],
    [Adw.SpinRow, SpinRowNode],
    [Gtk.Scale, ScaleNode],
    [Gtk.LevelBar, LevelBarNode],
    [Gtk.ScrolledWindow, ScrolledWindowNode],
    [Gtk.Calendar, CalendarNode],
    [Gtk.ColorDialogButton, ColorDialogButtonNode],
    [Gtk.FontDialogButton, FontDialogButtonNode],
    [Gtk.DrawingArea, DrawingAreaNode],
    [Gtk.SearchBar, SearchBarNode],
    [Adw.NavigationView, NavigationViewNode],
    [Adw.ToggleGroup, ToggleGroupNode],
    [Gtk.Notebook, NotebookNode],
    [StackWidgets, StackNode],
    [[Gtk.ListView, Gtk.ColumnView, Gtk.GridView, Gtk.DropDown, Adw.ComboRow], ListNode],
    [PopoverMenuWidgets, PopoverMenuNode],
    [AdjustableWidgets, AdjustableNode],
    [[Gtk.ListItem, Gtk.ListHeader], ListItemNode],
    [Gtk.Widget, WidgetNode],
];
