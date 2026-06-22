import "./utils/element-props.js";

export { withApplication, withApplicationWindow } from "./components/application.js";
export { type ConstraintLayoutProps, GtkConstraintLayout } from "./components/constraint-layout.js";
export {
    AdwComboRow,
    GtkColumnView,
    GtkColumnViewColumn,
    GtkDropDown,
    GtkGridView,
    GtkListView,
} from "./components/list.js";
export { GMenu, type MenuProps } from "./components/menu.js";
export { type TopLevelParentProps, withTopLevel } from "./components/top-level.js";
export { ApplicationContext, useApplication } from "./hooks/use-application.js";
export { useForwardedRef } from "./hooks/use-forwarded-ref.js";
export { useProperty } from "./hooks/use-property.js";
export { type RelocatableSchemaRef, type SchemaRef, useSetting } from "./hooks/use-setting.js";
export {
    type SignalHandlerFor,
    type SignalHandlersOf,
    type SignalNameOf,
    type UseSignalOptions,
    useSignal,
} from "./hooks/use-signal.js";
export { useTickCallback } from "./hooks/use-tick-callback.js";
export { type TopLevelSurface, useWindowPresentation } from "./hooks/use-window-presentation.js";
export { isInCommit, scheduleCommitWork } from "./reconciler/commit-flush.js";
export { createPortal } from "./reconciler/portal.js";
export { createRoot, quit, type Root } from "./reconciler/render.js";
export { createRootElement, type RootElement } from "./reconciler/root-element.js";
export {
    type ApplicationLifecycle,
    type ApplicationLifecycleModule,
    defaultApplicationLifecycle,
    setApplicationLifecycle,
} from "./utils/application-lifecycle.js";
export { createElementComponent } from "./utils/create-element-component.js";
export type {
    AccessibleProps,
    ActionAccel,
    ActionGroupPrefixProps,
    AlertDialogResponseProps,
    CalendarMark,
    ColumnViewColumnProps,
    ColumnViewProps,
    ConstraintGuideProps,
    ConstraintProps,
    ConstraintVflProps,
    ContainerPropProps,
    CreditSection,
    DragSourceIcon,
    DropDownProps,
    DropTargetType,
    FixedChildProps,
    GridChildProps,
    GridViewProps,
    LevelBarOffset,
    ListItem,
    ListViewProps,
    MenuEntry,
    MenuItemsProps,
    NotebookPageProps,
    OverlayChildProps,
    ScaleMark,
    SlotProps,
    StackPageProps,
    TextAnchorProps,
    TextPaintableProps,
    TextTagProps,
    WrapperNodeElementProps,
} from "./utils/element-props.js";
export type { GObjectTarget } from "./utils/gobject-target.js";
export {
    deleteAccessibleMetadata,
    getAccessibleMetadata,
    setAccessibleMetadata,
} from "./utils/widget-metadata.js";
