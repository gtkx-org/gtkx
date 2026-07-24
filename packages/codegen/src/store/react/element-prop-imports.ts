/** Props interface a generated element's props extend, declared by hand in `@gtkx/react`. */
export type ElementPropTypeRef = { type: string; module: string; export: string };

const REACT = "@gtkx/react";
const REACT_ADW = "@gtkx/react/adw";

export const BUILT_IN_ELEMENT_PROP_TYPES: ElementPropTypeRef[] = [
    { type: "GtkWidget", module: REACT, export: "GtkWidgetElementProps" },
    { type: "GActionGroup", module: REACT, export: "GActionGroupElementProps" },
    { type: "GActionMap", module: REACT, export: "GActionMapElementProps" },
    { type: "GMenu", module: REACT, export: "GMenuElementProps" },
    { type: "GtkShortcutController", module: REACT, export: "GtkShortcutControllerElementProps" },
    { type: "GtkOverlay", module: REACT, export: "GtkOverlayElementProps" },
    { type: "GtkConstraintLayout", module: REACT, export: "GtkConstraintLayoutElementProps" },
    { type: "GtkHeaderBar", module: REACT, export: "GtkHeaderBarElementProps" },
    { type: "GtkActionBar", module: REACT, export: "GtkHeaderBarElementProps" },
    { type: "GtkScale", module: REACT, export: "GtkScaleElementProps" },
    { type: "GtkCalendar", module: REACT, export: "GtkCalendarElementProps" },
    { type: "GtkLevelBar", module: REACT, export: "GtkLevelBarElementProps" },
    { type: "GtkSizeGroup", module: REACT, export: "GtkSizeGroupElementProps" },
    { type: "GtkAboutDialog", module: REACT, export: "GtkAboutDialogElementProps" },
    { type: "GtkApplication", module: REACT, export: "GtkApplicationElementProps" },
    { type: "GtkDropTarget", module: REACT, export: "GtkDropTargetElementProps" },
    { type: "GtkDrawingArea", module: REACT, export: "GtkDrawingAreaElementProps" },
    { type: "GtkDragSource", module: REACT, export: "GtkDragSourceElementProps" },
    { type: "AdwAlertDialog", module: REACT_ADW, export: "AdwAlertDialogElementProps" },
    { type: "AdwHeaderBar", module: REACT, export: "GtkHeaderBarElementProps" },
    { type: "AdwActionRow", module: REACT_ADW, export: "AdwPreferencesRowElementProps" },
    { type: "AdwEntryRow", module: REACT_ADW, export: "AdwPreferencesRowElementProps" },
    { type: "AdwExpanderRow", module: REACT_ADW, export: "AdwExpanderRowElementProps" },
    { type: "AdwToolbarView", module: REACT_ADW, export: "AdwToolbarViewElementProps" },
    { type: "AdwApplicationWindow", module: REACT_ADW, export: "AdwBreakpointsElementProps" },
    { type: "AdwWindow", module: REACT_ADW, export: "AdwBreakpointsElementProps" },
    { type: "AdwDialog", module: REACT_ADW, export: "AdwBreakpointsElementProps" },
    { type: "AdwBreakpointBin", module: REACT_ADW, export: "AdwBreakpointsElementProps" },
];

export const elementPropTypeFor = (glibName: string): ElementPropTypeRef | undefined =>
    BUILT_IN_ELEMENT_PROP_TYPES.find((entry) => entry.type === glibName);
