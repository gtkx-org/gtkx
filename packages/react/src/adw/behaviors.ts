import * as Adw from "@gtkx/gi/adw";
import type * as Gtk from "@gtkx/gi/gtk";
import {
    ADW_BOX_TYPES,
    ADW_SINGLE_CHILD_TYPES,
    ADW_SINGLE_CONTENT_TYPES,
    boxBehavior,
    childSetterBehavior,
    indexedBehavior,
    registerBehavior,
    registerListBehavior,
} from "../reconciler/element-rules.js";
import type { AlertDialogResponse } from "./element-props.js";

type AdwChildSetter =
    | Adw.Bin
    | Adw.BreakpointBin
    | Adw.Clamp
    | Adw.ClampScrollable
    | Adw.Dialog
    | Adw.NavigationPage
    | Adw.SplitButton
    | Adw.StatusPage
    | Adw.TabOverview
    | Adw.ToastOverlay
    | Adw.Toggle;

type AdwContentSetter =
    | Adw.ApplicationWindow
    | Adw.BottomSheet
    | Adw.Flap
    | Adw.OverlaySplitView
    | Adw.Window
    | Adw.ToolbarView;

registerBehavior(ADW_SINGLE_CHILD_TYPES, "children", "GtkWidget", childSetterBehavior<AdwChildSetter>());

registerBehavior<AdwContentSetter, Gtk.Widget>(ADW_SINGLE_CONTENT_TYPES, "children", "GtkWidget", {
    attach: (parent, child) => parent.setContent(child),
    detach: (parent) => parent.setContent(null),
});

registerBehavior<Adw.NavigationSplitView, Adw.NavigationPage>(
    ["AdwNavigationSplitView"],
    "children",
    "AdwNavigationPage",
    {
        attach: (view, page) => view.setContent(page),
        detach: (view) => view.setContent(null),
    },
);

registerBehavior(ADW_BOX_TYPES, "children", "GtkWidget", boxBehavior<Adw.Leaflet | Adw.WrapBox>());

registerBehavior<Adw.Carousel, Gtk.Widget>(["AdwCarousel"], "children", "GtkWidget", {
    ...indexedBehavior<Adw.Carousel>(),
    reorder: (carousel, child, { index }) => carousel.reorder(child, index),
});

registerBehavior<Adw.PreferencesPage, Adw.PreferencesGroup>(["AdwPreferencesPage"], "children", "AdwPreferencesGroup", {
    attach: (page, group) => page.add(group),
    detach: (page, group) => page.remove(group),
    insert: (page, group, { index }) => page.insert(group, index),
});

registerBehavior<Adw.TabView, Gtk.Widget>(["AdwTabView"], "children", "GtkWidget", {
    attach: (view, child) => view.append(child),
    insert: (view, child, { index }) => view.insert(child, index),
    reorder: (view, _child, { adopted, index }) => {
        if (adopted instanceof Adw.TabPage) view.reorderPage(adopted, index);
    },
    detach: (view, _child, { adopted }) => {
        if (adopted instanceof Adw.TabPage) view.closePage(adopted);
    },
    resolve: (view, child) => view.getPage(child),
});

registerListBehavior<Adw.AlertDialog, AlertDialogResponse>("AdwAlertDialog", "responses", {
    add: (dialog, response) => {
        dialog.addResponse(response.id, response.label);
        if (response.appearance !== undefined) dialog.setResponseAppearance(response.id, response.appearance);
        if (response.enabled !== undefined) dialog.setResponseEnabled(response.id, response.enabled);
    },
    remove: (dialog, response) => dialog.removeResponse(response.id),
});
