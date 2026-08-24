import type * as Gtk from "@gtkx/gi/gtk";
import * as Adw from "@gtkx/gi/adw";
import { coerceObjectProperty } from "@gtkx/runtime";
import type { AlertDialogResponse, NavigationStackEntry, ViewStackPageTransition } from "./prop-types.js";
import {
    addRemoveSlot,
    adoptedChildrenSlot,
    applicationCreator,
    boxSlot,
    childMatcher,
    childSetterSlot,
    contentSetterSlot,
    deferred,
    indexedSlot,
    list,
    slot,
} from "../reconciler/behaviors.js";
import { runWithErrorReporter } from "../reconciler/commit-errors.js";
import { type ElementBehavior, type ElementConfig, forTypes, registerElements } from "../reconciler/registry.js";
import { applyMutation, applyWrite } from "../reconciler/signals.js";
import { BUILTIN_ELEMENTS, CHILD_SETTER_TYPES, CONTENT_SETTER_TYPES } from "./element-config.js";

type AdwChildSetter =
    | Adw.Bin |
    Adw.BreakpointBin |
    Adw.Clamp |
    Adw.Dialog |
    Adw.NavigationPage |
    Adw.SplitButton |
    Adw.StatusPage |
    Adw.TabOverview |
    Adw.ToastOverlay |
    Adw.Toggle;

type AdwContentSetter = Adw.ApplicationWindow | Adw.BottomSheet | Adw.OverlaySplitView | Adw.Window;
type BreakpointHost = Adw.ApplicationWindow | Adw.Window | Adw.Dialog;
type PrefixSuffixRow = Adw.ActionRow | Adw.EntryRow | Adw.ExpanderRow;

type NavigationStackState = {
    desired: readonly NavigationStackEntry[] | null;
    applied: readonly NavigationStackEntry[];
    fallback: boolean;
    isCommitted: boolean;
    isInitial: boolean;
    shouldReadFallback: boolean;
    shouldRestoreFallback: boolean;
    timer: ReturnType<typeof setTimeout> | null;
    disconnect: (() => void) | null;
    reportError: ((error: unknown) => void) | null;
};

type ViewStackTransitionsState = {
    desired: readonly ViewStackPageTransition[] | null;
    controlledName: string | null;
    fallback: boolean;
    isCommitted: boolean;
    isScheduled: boolean;
    shouldReadFallback: boolean;
    shouldRestoreFallback: boolean;
    disconnect: (() => void) | null;
    reportError: ((error: unknown) => void) | null;
};

type ViewStackTransitionsUpdate = {
    previousFallback: unknown;
    nextFallback: unknown;
    controlledName: string | null;
    desired: readonly ViewStackPageTransition[] | null;
};

type ViewStackSettlement = {
    controlledName: string | null;
    canSetVisible: boolean;
    transitionName: string | null;
    shouldApplyFallback: boolean;
};

type NavigationStackMutation = {
    view: Adw.NavigationView;
    state: NavigationStackState;
    current: readonly string[];
    desired: readonly string[];
    isCurrentRepresentable: boolean;
    isFinalAnimationEnabled: boolean;
    isOutgoingAnimationEnabled: boolean;
};

type OverlaySplitViewMode = {
    isPinned: boolean | null;
    isCollapsed: boolean | null;
    isSidebarShown: boolean | null;
};

type OverlaySplitViewModeState = {
    desired: OverlaySplitViewMode;
    isScheduled: boolean;
    disconnect: (() => void) | null;
    reportError: ((error: unknown) => void) | null;
};

type ControlledModeValue = {
    desired: boolean | null;
    immediate: boolean | null;
};

type ToggleGroupSelectionState = {
    desired: ToggleGroupSelection;
    isScheduled: boolean;
    disconnect: (() => void) | null;
    reportError: ((error: unknown) => void) | null;
};

type ToggleGroupSelection = { kind: "name"; value: string | null } | { kind: "index"; value: number } | null;
type ToggleGroupNameValue = { desired: string | null; isPresent: boolean };
type ToggleGroupIndexValue = { desired: number; isPresent: boolean };

const SLOT_SUFFIX = "Slot";
const childSetter = childSetterSlot<AdwChildSetter>();
const contentSetter = contentSetterSlot<AdwContentSetter>();

const breakpoints = slot<BreakpointHost, Adw.Breakpoint>("breakpoints", "AdwBreakpoint", {
    attach: (host, breakpoint) => {
        host.addBreakpoint(breakpoint);
    },
});

const prefixSuffix = [
    addRemoveSlot<Gtk.Widget, PrefixSuffixRow>(
        "prefix",
        "GtkWidget",
        (row, child) => {
            row.addPrefix(child);
        },
        (row, child) => {
            row.remove(child);
        },
    ),
    addRemoveSlot<Gtk.Widget, PrefixSuffixRow>(
        "suffix",
        "GtkWidget",
        (row, child) => {
            row.addSuffix(child);
        },
        (row, child) => {
            row.remove(child);
        },
    ),
];

const preferencesDialogChildren = addRemoveSlot<Adw.PreferencesPage, Adw.PreferencesDialog>(
    "children",
    "AdwPreferencesPage",
    (dialog, page) => {
        dialog.add(page);
    },
    (dialog, page) => {
        dialog.remove(page);
    },
);

const alertDialogExtraChild = slot<Adw.AlertDialog, Gtk.Widget>("children", "GtkWidget", {
    attach: (dialog, child) => {
        dialog.setExtraChild(child);
    },
    detach: (dialog) => {
        dialog.setExtraChild(null);
    },
});

const sidebarSections = indexedSlot<Adw.Sidebar, Adw.SidebarSection>("children", "AdwSidebarSection");
const sidebarItems = indexedSlot<Adw.SidebarSection, Adw.SidebarItem>("children", "AdwSidebarItem");
const isWidget = childMatcher("GtkWidget");

const overlaySplitViewMode: ElementBehavior<Adw.OverlaySplitView> = {
    deferred: ["pinSidebar", "collapsed", "showSidebar"],
    initialize: (): OverlaySplitViewModeState => ({
        desired: { isPinned: null, isCollapsed: null, isSidebarShown: null },
        isScheduled: false,
        disconnect: null,
        reportError: null,
    }),
    validate: (_view, prev, next) => {
        controlledModeValue(prev.pinSidebar, next.pinSidebar, false, "pinSidebar");
        controlledModeValue(prev.collapsed, next.collapsed, false, "collapsed");
        controlledModeValue(prev.showSidebar, next.showSidebar, true, "showSidebar");
    },
    update: (view, prev, next, context) => {
        const state = context as OverlaySplitViewModeState;
        const pinned = controlledModeValue(prev.pinSidebar, next.pinSidebar, false, "pinSidebar");
        const collapsed = controlledModeValue(prev.collapsed, next.collapsed, false, "collapsed");
        const shown = controlledModeValue(prev.showSidebar, next.showSidebar, true, "showSidebar");

        state.desired = {
            isPinned: pinned.desired,
            isCollapsed: collapsed.desired,
            isSidebarShown: shown.desired,
        };

        applyOverlaySplitViewMode(view, {
            isPinned: pinned.immediate,
            isCollapsed: collapsed.immediate,
            isSidebarShown: shown.immediate,
        });

        return ["pinSidebar", "collapsed", "showSidebar"];
    },
    flush: (view, context, reportError) => {
        const state = context as OverlaySplitViewModeState;
        state.reportError = reportError;
        watchOverlaySplitViewMode(view, state);
    },
    teardown: (_view, context) => {
        const state = context as OverlaySplitViewModeState;
        state.disconnect?.();
        state.disconnect = null;
        state.reportError = null;
    },
};

const navigationStack: ElementBehavior<Adw.NavigationView> = {
    deferred: ["navigationStack"],
    initialize: (view): NavigationStackState => {
        return {
            desired: null,
            applied: [],
            fallback: view.getAnimateTransitions(),
            isCommitted: false,
            isInitial: true,
            shouldReadFallback: false,
            shouldRestoreFallback: false,
            timer: null,
            disconnect: null,
            reportError: null,
        };
    },
    validate: (view, _prev, next, context) => {
        const desired = navigationStackValue(next.navigationStack);

        if (desired !== null && (context as NavigationStackState).isCommitted) {
            assertNavigationStack(view, desired);
        }
    },
    update: (view, prev, next, context) => {
        const state = context as NavigationStackState;
        const desired = navigationStackValue(next.navigationStack);

        if (desired !== null && state.isCommitted) {
            assertNavigationStack(view, desired);
        }

        updateNavigationStack(state, prev.animateTransitions, next.animateTransitions, desired);

        return ["navigationStack"];
    },
    flush: (view, context, reportError) => {
        const state = context as NavigationStackState;
        state.reportError = reportError;
        watchNavigationStack(view, state);
        settleNavigationStack(view, state);
        state.isCommitted = true;
    },
    teardown: (_view, context) => {
        const state = context as NavigationStackState;

        if (state.timer !== null) {
            clearTimeout(state.timer);
            state.timer = null;
        }

        state.disconnect?.();
        state.disconnect = null;
        state.reportError = null;
    },
};

const pageTransitions: ElementBehavior<Adw.ViewStack> = {
    deferred: ["pageTransitions", "visibleChildName"],
    initialize: (stack): ViewStackTransitionsState => {
        return {
            desired: null,
            controlledName: null,
            fallback: stack.getEnableTransitions(),
            isCommitted: false,
            isScheduled: false,
            shouldReadFallback: false,
            shouldRestoreFallback: false,
            disconnect: null,
            reportError: null,
        };
    },
    validate: (stack, _prev, next, context) => {
        const desired = pageTransitionsValue(next.pageTransitions);
        controlledViewStackName(next.visibleChildName);

        if (desired !== null && (context as ViewStackTransitionsState).isCommitted) {
            assertPageTransitions(stack, desired);
        }
    },
    update: (stack, prev, next, context) => {
        const state = context as ViewStackTransitionsState;
        const desired = pageTransitionsValue(next.pageTransitions);
        const controlledName = controlledViewStackName(next.visibleChildName);

        if (desired !== null && state.isCommitted) {
            assertPageTransitions(stack, desired);
        }

        updateViewStackTransitions(state, {
            previousFallback: prev.enableTransitions,
            nextFallback: next.enableTransitions,
            controlledName,
            desired,
        });

        return ["pageTransitions", "visibleChildName"];
    },
    flush: (stack, context, reportError) => {
        const state = context as ViewStackTransitionsState;
        state.reportError = reportError;
        watchViewStackTransitions(stack, state);

        if (state.shouldReadFallback) {
            state.fallback = stack.getEnableTransitions();
            state.shouldReadFallback = false;
        }

        if (state.desired !== null) {
            assertPageTransitions(stack, state.desired);
        }

        settleControlledViewStack(stack, state, state.shouldRestoreFallback);
        state.shouldRestoreFallback = false;
        state.isCommitted = true;
    },
    teardown: (_stack, context) => {
        const state = context as ViewStackTransitionsState;
        state.disconnect?.();
        state.disconnect = null;
        state.reportError = null;
    },
};

const toggleGroupSelection: ElementBehavior<Adw.ToggleGroup> = {
    deferred: ["activeName", "active"],
    initialize: (): ToggleGroupSelectionState => ({
        desired: null,
        isScheduled: false,
        disconnect: null,
        reportError: null,
    }),
    validate: (group, _prev, next) => {
        const name = toggleGroupNameValue(next.activeName);
        const index = toggleGroupIndexValue(group, next.active);

        if (name.isPresent && index.isPresent) {
            throw new TypeError("activeName and active cannot both control an AdwToggleGroup");
        }
    },
    update: (group, _prev, next, context) => {
        const state = context as ToggleGroupSelectionState;
        const name = toggleGroupNameValue(next.activeName);
        const index = toggleGroupIndexValue(group, next.active);

        if (name.isPresent && index.isPresent) {
            throw new TypeError("activeName and active cannot both control an AdwToggleGroup");
        }

        state.desired = toggleGroupSelectionValue(name, index);

        return ["activeName", "active"];
    },
    flush: (group, context, reportError) => {
        const state = context as ToggleGroupSelectionState;
        state.reportError = reportError;
        settleToggleGroupSelection(group, state);
        watchToggleGroupSelection(group, state);
    },
    teardown: (_group, context) => {
        const state = context as ToggleGroupSelectionState;
        state.disconnect?.();
        state.disconnect = null;
        state.reportError = null;
    },
};

const multiLayoutSlots: ElementBehavior<Adw.MultiLayoutView> = {
    attach: (view, child, info) => {
        const id = getSlotId(info.slot);

        if (id === null || !isWidget(child)) {
            return;
        }

        view.setChild(id, child as Gtk.Widget);

        return true;
    },
    detach: (view, child, info) => {
        const id = getSlotId(info.slot);

        if (id === null || !isWidget(child)) {
            return;
        }

        const widget = child as Gtk.Widget;

        if (view.getChild(id) === widget) {
            widget.unparent();
        }
    },
};

const multiLayoutLayouts = slot<Adw.MultiLayoutView, Gtk.Widget>("layouts", "GtkWidget", {
    attach: (view, content) => {
        const layout = new Adw.Layout({ content });
        view.addLayout(layout);

        return layout;
    },
    reorder: (_view, _content, info) => info.adopted,
    detach: (view, _content, info) => {
        if (info.adopted instanceof Adw.Layout) {
            view.removeLayout(info.adopted);
        }
    },
});

const BUILTIN_BEHAVIORS: Record<string, ElementConfig<never>> = {
    AdwApplication: {
        behaviors: [applicationCreator(Adw.Application)],
    },
    AdwSidebar: {
        behaviors: [sidebarSections],
    },
    AdwSidebarSection: {
        behaviors: [sidebarItems],
    },
    AdwMultiLayoutView: {
        behaviors: [
            multiLayoutLayouts,
            multiLayoutSlots,
            deferred<Adw.MultiLayoutView, "string">(
                "layoutName",
                "string",
                (view, name) => name === null || view.getLayoutByName(name) !== null,
            ),
        ],
    },
    AdwClampScrollable: {
        behaviors: [
            slot<Adw.ClampScrollable, Gtk.Scrollable & Gtk.Widget>("children", "GtkScrollable", {
                attach: (clamp, child) => {
                    clamp.setChild(child);
                },
                detach: (clamp) => {
                    clamp.setChild(null);
                },
            }),
        ],
    },
    ...forTypes(CHILD_SETTER_TYPES, {
        behaviors: [childSetter],
    }),
    ...forTypes(CONTENT_SETTER_TYPES, {
        behaviors: [contentSetter],
    }),
    AdwOverlaySplitView: {
        behaviors: [contentSetter, overlaySplitViewMode],
    },
    AdwDialog: {
        behaviors: [childSetter, breakpoints],
    },
    AdwApplicationWindow: {
        behaviors: [contentSetter, breakpoints],
    },
    AdwWindow: {
        behaviors: [contentSetter, breakpoints],
    },
    AdwBreakpointBin: {
        behaviors: [
            childSetter,
            addRemoveSlot<Adw.Breakpoint, Adw.BreakpointBin>(
                "breakpoints",
                "AdwBreakpoint",
                (bin, breakpoint) => {
                    bin.addBreakpoint(breakpoint);
                },
                (bin, breakpoint) => {
                    bin.removeBreakpoint(breakpoint);
                },
            ),
        ],
    },
    AdwActionRow: {
        behaviors: prefixSuffix,
    },
    AdwEntryRow: {
        behaviors: prefixSuffix,
    },
    AdwExpanderRow: {
        behaviors: [
            ...prefixSuffix,
            addRemoveSlot<Gtk.Widget, Adw.ExpanderRow>(
                "rows",
                "GtkWidget",
                (row, child) => {
                    row.addRow(child);
                },
                (row, child) => {
                    row.remove(child);
                },
            ),
        ],
    },
    AdwNavigationSplitView: {
        behaviors: [
            contentSetterSlot<Adw.NavigationSplitView, Adw.NavigationPage>("AdwNavigationPage"),
            deferred<Adw.NavigationSplitView, "boolean">("showContent", "boolean"),
        ],
    },
    AdwWrapBox: {
        behaviors: [boxSlot<Adw.WrapBox>()],
    },
    AdwCarousel: {
        behaviors: [
            slot<Adw.Carousel, Gtk.Widget>("children", "GtkWidget", {
                attach: (carousel, child, info) => {
                    carousel.insert(child, info.index);
                },
                detach: (carousel, child) => {
                    carousel.remove(child);
                },
                reorder: (carousel, child, info) => {
                    carousel.reorder(child, info.index);
                },
            }),
        ],
    },
    AdwPreferencesPage: {
        behaviors: [
            slot<Adw.PreferencesPage, Adw.PreferencesGroup>("children", "AdwPreferencesGroup", {
                attach: (page, group, info) => {
                    page.insert(group, info.index);
                },
                detach: (page, group) => {
                    page.remove(group);
                },
            }),
        ],
    },
    AdwPreferencesDialog: {
        behaviors: [preferencesDialogChildren],
    },
    AdwPreferencesGroup: {
        behaviors: [
            addRemoveSlot<Gtk.Widget, Adw.PreferencesGroup>(
                "children",
                "GtkWidget",
                (group, child) => {
                    group.add(child);
                },
                (group, child) => {
                    group.remove(child);
                },
            ),
        ],
    },
    AdwTabView: {
        behaviors: [
            slot<Adw.TabView, Gtk.Widget>("children", "GtkWidget", {
                attach: (view, child, info) => view.insert(child, info.index),
                reorder: (view, _child, info) => {
                    if (info.adopted instanceof Adw.TabPage) {
                        view.reorderPage(info.adopted, info.index);
                    }
                },
                detach: (view, _child, info) => {
                    if (info.adopted instanceof Adw.TabPage) {
                        view.closePage(info.adopted);
                    }
                },
                resolve: (view, child) => view.getPage(child),
            }),
        ],
    },
    AdwNavigationView: {
        behaviors: [
            addRemoveSlot<Adw.NavigationPage, Adw.NavigationView>(
                "children",
                "AdwNavigationPage",
                (view, page) => {
                    view.add(page);
                },
                (view, page) => {
                    view.remove(page);
                },
            ),
            navigationStack,
        ],
    },
    AdwViewStack: {
        behaviors: [
            adoptedChildrenSlot<Adw.ViewStack, Gtk.Widget>(
                "GtkWidget",
                (stack, child) => stack.add(child),
                (stack, child) => {
                    stack.remove(child);
                },
            ),
            pageTransitions,
        ],
    },
    AdwToolbarView: {
        behaviors: [
            contentSetterSlot<Adw.ToolbarView>(),
            addRemoveSlot<Gtk.Widget, Adw.ToolbarView>(
                "topBar",
                "GtkWidget",
                (view, child) => {
                    view.addTopBar(child);
                },
                (view, child) => {
                    view.remove(child);
                },
            ),
            addRemoveSlot<Gtk.Widget, Adw.ToolbarView>(
                "bottomBar",
                "GtkWidget",
                (view, child) => {
                    view.addBottomBar(child);
                },
                (view, child) => {
                    view.remove(child);
                },
            ),
        ],
    },
    AdwHeaderBar: {
        behaviors: [
            slot<Adw.HeaderBar, Gtk.Widget>("start", "GtkWidget", {
                attach: (bar, child) => {
                    bar.packStart(child);
                },
                detach: (bar, child) => {
                    bar.remove(child);
                },
            }),
            slot<Adw.HeaderBar, Gtk.Widget>("end", "GtkWidget", {
                attach: (bar, child) => {
                    bar.packEnd(child);
                },
                detach: (bar, child) => {
                    bar.remove(child);
                },
            }),
        ],
    },
    AdwShortcutsDialog: {
        behaviors: [
            slot<Adw.ShortcutsDialog, Adw.ShortcutsSection>("children", "AdwShortcutsSection", {
                attach: (dialog, section) => {
                    dialog.add(section);
                },
            }),
        ],
    },
    AdwShortcutsSection: {
        behaviors: [
            slot<Adw.ShortcutsSection, Adw.ShortcutsItem>("children", "AdwShortcutsItem", {
                attach: (section, item) => {
                    section.add(item);
                },
            }),
        ],
    },
    AdwToggleGroup: {
        behaviors: [
            addRemoveSlot<Adw.Toggle, Adw.ToggleGroup>(
                "children",
                "AdwToggle",
                (group, toggle) => {
                    group.add(toggle);
                },
                (group, toggle) => {
                    group.remove(toggle);
                },
            ),
            toggleGroupSelection,
        ],
    },
    AdwAlertDialog: {
        behaviors: [
            alertDialogExtraChild,
            list<Adw.AlertDialog, AlertDialogResponse>("responses", {
                add: (dialog, response) => {
                    dialog.addResponse(response.id, response.label);

                    if (response.appearance !== undefined) {
                        dialog.setResponseAppearance(response.id, response.appearance);
                    }

                    if (response.isEnabled !== undefined) {
                        dialog.setResponseEnabled(response.id, response.isEnabled);
                    }
                },
                remove: (dialog, response) => {
                    dialog.removeResponse(response.id);
                },
                rollback: (dialog, response) => {
                    if (dialog.hasResponse(response.id)) {
                        dialog.removeResponse(response.id);
                    }
                },
            }),
        ],
    },
};

function toggleGroupNameValue(value: unknown): ToggleGroupNameValue {
    if (value === undefined) {
        return { desired: null, isPresent: false };
    }

    if (value === null || typeof value === "string") {
        return { desired: value, isPresent: true };
    }

    throw new TypeError("activeName must be a string or null when provided");
}

function toggleGroupIndexValue(group: Adw.ToggleGroup, value: unknown): ToggleGroupIndexValue {
    if (value === undefined || value === null) {
        return { desired: 0, isPresent: false };
    }

    const prepared = coerceObjectProperty(group, "active", value);

    if (!Number.isSafeInteger(prepared)) {
        throw new TypeError("active must be an integer when provided");
    }

    return { desired: prepared as number, isPresent: true };
}

function toggleGroupSelectionValue(
    name: ToggleGroupNameValue,
    index: ToggleGroupIndexValue,
): ToggleGroupSelection {
    if (name.isPresent) {
        return { kind: "name", value: name.desired };
    }

    return index.isPresent ? { kind: "index", value: index.desired } : null;
}

function applyToggleGroupName(group: Adw.ToggleGroup, name: string | null): void {
    if (name !== null && group.getToggleByName(name) === null) {
        return;
    }

    if (!Object.is(group.getActiveName(), name)) {
        applyWrite("activeName", () => {
            group.setActiveName(name);
        });
    }
}

function applyToggleGroupIndex(group: Adw.ToggleGroup, index: number): void {
    if (group.getActive() !== index) {
        applyWrite("active", () => {
            group.setActive(index);
        });
    }
}

function settleToggleGroupSelection(group: Adw.ToggleGroup, state: ToggleGroupSelectionState): void {
    if (state.desired?.kind === "name") {
        applyToggleGroupName(group, state.desired.value);
    } else if (state.desired?.kind === "index") {
        applyToggleGroupIndex(group, state.desired.value);
    }
}

function scheduleToggleGroupSelection(group: Adw.ToggleGroup, state: ToggleGroupSelectionState): void {
    if (state.isScheduled) {
        return;
    }

    state.isScheduled = true;

    queueMicrotask(() => {
        state.isScheduled = false;

        if (state.disconnect !== null) {
            runWithErrorReporter(state.reportError, () => {
                settleToggleGroupSelection(group, state);
            });
        }
    });
}

function watchToggleGroupSelection(group: Adw.ToggleGroup, state: ToggleGroupSelectionState): void {
    if (state.disconnect !== null) {
        return;
    }

    const handler = (): undefined => {
        scheduleToggleGroupSelection(group, state);
    };

    group.on("notify::active-name", handler);
    group.on("notify::active", handler);

    state.disconnect = (): void => {
        group.off("notify::active-name", handler);
        group.off("notify::active", handler);
    };
}

function controlledModeValue(
    previous: unknown,
    next: unknown,
    isFallback: boolean,
    property: string,
): ControlledModeValue {
    if (typeof next === "boolean") {
        return { desired: next, immediate: next };
    }

    if (next === undefined || next === null) {
        return releasedModeValue(previous, isFallback);
    }

    throw new TypeError(`${property} must be a boolean when provided`);
}

function releasedModeValue(previous: unknown, isFallback: boolean): ControlledModeValue {
    return { desired: null, immediate: typeof previous === "boolean" ? isFallback : null };
}

function setOverlaySplitViewPinned(view: Adw.OverlaySplitView, isPinned: boolean | null): void {
    if (isPinned !== null && view.getPinSidebar() !== isPinned) {
        view.setPinSidebar(isPinned);
    }
}

function setOverlaySplitViewCollapsed(view: Adw.OverlaySplitView, isCollapsed: boolean | null): void {
    if (isCollapsed !== null && view.getCollapsed() !== isCollapsed) {
        view.setCollapsed(isCollapsed);
    }
}

function setOverlaySplitViewShown(
    view: Adw.OverlaySplitView,
    isShown: boolean | null,
): void {
    if (isShown !== null && view.getShowSidebar() !== isShown) {
        view.setShowSidebar(isShown);
    }
}

function applyOverlaySplitViewMode(view: Adw.OverlaySplitView, mode: OverlaySplitViewMode): void {
    applyMutation(() => {
        setOverlaySplitViewPinned(view, mode.isPinned);
        setOverlaySplitViewCollapsed(view, mode.isCollapsed);
        setOverlaySplitViewShown(view, mode.isSidebarShown);
    });
}

function scheduleOverlaySplitViewMode(view: Adw.OverlaySplitView, state: OverlaySplitViewModeState): void {
    if (state.isScheduled) {
        return;
    }

    state.isScheduled = true;

    queueMicrotask(() => {
        state.isScheduled = false;

        if (state.disconnect !== null) {
            runWithErrorReporter(state.reportError, () => {
                applyOverlaySplitViewMode(view, state.desired);
            });
        }
    });
}

function watchOverlaySplitViewMode(view: Adw.OverlaySplitView, state: OverlaySplitViewModeState): void {
    if (state.disconnect !== null) {
        return;
    }

    const onModeChanged = (): void => {
        scheduleOverlaySplitViewMode(view, state);
    };

    view.on("notify::pin-sidebar", onModeChanged);
    view.on("notify::collapsed", onModeChanged);
    view.on("notify::show-sidebar", onModeChanged);

    state.disconnect = (): void => {
        view.off("notify::pin-sidebar", onModeChanged);
        view.off("notify::collapsed", onModeChanged);
        view.off("notify::show-sidebar", onModeChanged);
    };
}

function isObject(value: unknown): value is object {
    return typeof value === "object" && value !== null;
}

function navigationPageTag(value: unknown): string | null {
    return value instanceof Adw.NavigationPage ? value.getTag() : null;
}

function readNavigationTags(view: Adw.NavigationView): string[] | null {
    const model = view.getNavigationStack();
    const tags: string[] = [];

    for (let index = 0; index < model.getNItems(); index += 1) {
        const tag = navigationPageTag(model.getItem(index));

        if (tag === null) {
            return null;
        }

        tags.push(tag);
    }

    return tags;
}

function areNavigationTagsEqual(left: readonly string[], right: readonly string[]): boolean {
    return left.length === right.length && left.every((tag, index) => tag === right[index]);
}

function isStrictPrefix(prefix: readonly string[], list: readonly string[]): boolean {
    return prefix.length < list.length && prefix.every((tag, index) => tag === list[index]);
}

function navigationStackEntryValue(value: unknown): NavigationStackEntry {
    if (!isObject(value)) {
        throw new TypeError("navigationStack entries must be objects");
    }

    const tag = "tag" in value ? value.tag : undefined;
    const animateTransitions = "animateTransitions" in value ? value.animateTransitions : undefined;

    if (typeof tag !== "string" || typeof animateTransitions !== "boolean") {
        throw new TypeError("navigationStack entries require a string tag and boolean animateTransitions");
    }

    return { tag, animateTransitions };
}

function navigationStackEntryTag(entry: NavigationStackEntry): string {
    return entry.tag;
}

function hasUniqueNavigationTags(entries: readonly NavigationStackEntry[]): boolean {
    return new Set(entries.map((entry) => navigationStackEntryTag(entry))).size === entries.length;
}

function navigationStackValue(value: unknown): readonly NavigationStackEntry[] | null {
    if (value === undefined || value === null) {
        return null;
    }

    if (!Array.isArray(value)) {
        throw new TypeError("navigationStack must be an array");
    }

    const entries = value.map((entry) => navigationStackEntryValue(entry));

    if (!hasUniqueNavigationTags(entries)) {
        throw new Error("navigationStack must contain unique tags");
    }

    return entries;
}

function updateNavigationStack(
    state: NavigationStackState,
    previousFallback: unknown,
    nextFallback: unknown,
    desired: readonly NavigationStackEntry[] | null,
): void {
    const previous = state.desired;
    state.desired = desired;
    state.shouldRestoreFallback = previous !== null && desired === null;

    state.shouldReadFallback = typeof nextFallback !== "boolean" && (
        (previous === null && desired !== null) || typeof previousFallback === "boolean"
    );

    if (typeof nextFallback === "boolean") {
        state.fallback = nextFallback;
    }
}

function assertNavigationStack(view: Adw.NavigationView, entries: readonly NavigationStackEntry[]): void {
    const tags = entries.map((entry) => navigationStackEntryTag(entry));

    if (tags.some((tag) => view.findPage(tag) === null)) {
        throw new Error("navigationStack tags must belong to the view");
    }
}

function isAnimationEnabledFor(
    entries: readonly NavigationStackEntry[],
    tag: string | undefined,
    isFallbackEnabled: boolean,
): boolean {
    return entries.find((entry) => entry.tag === tag)?.animateTransitions ?? isFallbackEnabled;
}

function replaceNavigationStack(
    view: Adw.NavigationView,
    current: readonly string[],
    desired: readonly string[],
): void {
    if (!areNavigationTagsEqual(current, desired)) {
        view.replaceWithTags([...desired]);
    }
}

function popNavigationStack(mutation: NavigationStackMutation): void {
    const { view, desired, isOutgoingAnimationEnabled } = mutation;
    const visible = desired.at(-1);
    view.setAnimateTransitions(isOutgoingAnimationEnabled);

    if (visible === undefined) {
        view.replaceWithTags([]);
    } else {
        view.popToTag(visible);
    }
}

function pushNavigationStack(mutation: NavigationStackMutation): void {
    const { view, desired } = mutation;
    const incoming = desired.at(-1);

    if (incoming !== undefined) {
        view.pushByTag(incoming);
    }
}

function mutateRepresentedNavigationStack(mutation: NavigationStackMutation): void {
    const { view, state, current, desired } = mutation;

    if (state.isInitial) {
        replaceNavigationStack(view, current, desired);
    } else if (isStrictPrefix(desired, current)) {
        popNavigationStack(mutation);
    } else if (desired.length === current.length + 1 && isStrictPrefix(current, desired)) {
        pushNavigationStack(mutation);
    } else {
        replaceNavigationStack(view, current, desired);
    }
}

function mutateNavigationStack(mutation: NavigationStackMutation): void {
    const { view, desired, isCurrentRepresentable, isFinalAnimationEnabled } = mutation;
    view.setAnimateTransitions(isFinalAnimationEnabled);

    if (isCurrentRepresentable) {
        mutateRepresentedNavigationStack(mutation);
    } else {
        view.replaceWithTags([...desired]);
    }

    view.setAnimateTransitions(isFinalAnimationEnabled);
}

function writeNavigationStack(
    view: Adw.NavigationView,
    state: NavigationStackState,
    current: readonly string[] | null,
    desired: readonly string[],
): void {
    const visible = desired.at(-1);
    const representedCurrent = current ?? [];

    const mutation: NavigationStackMutation = {
        view,
        state,
        current: representedCurrent,
        desired,
        isCurrentRepresentable: current !== null,
        isFinalAnimationEnabled: isAnimationEnabledFor(
            state.desired ?? [],
            visible,
            view.getAnimateTransitions(),
        ),
        isOutgoingAnimationEnabled: isAnimationEnabledFor(
            state.applied,
            representedCurrent.at(-1),
            view.getAnimateTransitions(),
        ),
    };

    applyMutation(() => {
        mutateNavigationStack(mutation);
    });
}

function restoreNavigationStackFallback(view: Adw.NavigationView, state: NavigationStackState): void {
    if (state.shouldRestoreFallback && view.getAnimateTransitions() !== state.fallback) {
        applyMutation(() => {
            view.setAnimateTransitions(state.fallback);
        });
    }

    state.shouldRestoreFallback = false;
    state.applied = [];
}

function settleNavigationStack(view: Adw.NavigationView, state: NavigationStackState): void {
    if (state.timer !== null) {
        clearTimeout(state.timer);
        state.timer = null;
    }

    if (state.shouldReadFallback) {
        state.fallback = view.getAnimateTransitions();
        state.shouldReadFallback = false;
    }

    const { desired } = state;

    if (desired === null) {
        restoreNavigationStackFallback(view, state);

        return;
    }

    assertNavigationStack(view, desired);
    writeNavigationStack(view, state, readNavigationTags(view), desired.map((entry) => navigationStackEntryTag(entry)));
    state.applied = desired;
    state.isInitial = false;
    state.shouldRestoreFallback = false;
}

function scheduleNavigationStack(view: Adw.NavigationView, state: NavigationStackState): void {
    if (state.timer !== null) {
        return;
    }

    state.timer = setTimeout(() => {
        state.timer = null;

        runWithErrorReporter(state.reportError, () => {
            settleNavigationStack(view, state);
        });
    }, 0);
}

function watchNavigationStack(view: Adw.NavigationView, state: NavigationStackState): void {
    if (state.disconnect !== null) {
        return;
    }

    const model = view.getNavigationStack();

    const onItemsChanged = (): void => {
        scheduleNavigationStack(view, state);
    };

    model.on("items-changed", onItemsChanged);

    state.disconnect = (): void => {
        model.off("items-changed", onItemsChanged);
    };
}

function pageTransitionValue(value: unknown): ViewStackPageTransition {
    if (!isObject(value)) {
        throw new TypeError("pageTransitions entries must be objects");
    }

    const name = "name" in value ? value.name : undefined;
    const animateTransitions = "animateTransitions" in value ? value.animateTransitions : undefined;

    if (typeof name !== "string" || typeof animateTransitions !== "boolean") {
        throw new TypeError("pageTransitions entries require a string name and boolean animateTransitions");
    }

    return { name, animateTransitions };
}

function pageTransitionName(entry: ViewStackPageTransition): string {
    return entry.name;
}

function hasUniquePageTransitionNames(entries: readonly ViewStackPageTransition[]): boolean {
    return new Set(entries.map((entry) => pageTransitionName(entry))).size === entries.length;
}

function pageTransitionsValue(value: unknown): readonly ViewStackPageTransition[] | null {
    if (value === undefined || value === null) {
        return null;
    }

    if (!Array.isArray(value)) {
        throw new TypeError("pageTransitions must be an array");
    }

    const entries = value.map((entry) => pageTransitionValue(entry));

    if (!hasUniquePageTransitionNames(entries)) {
        throw new Error("pageTransitions must contain unique page names");
    }

    return entries;
}

function updateViewStackTransitions(
    state: ViewStackTransitionsState,
    update: ViewStackTransitionsUpdate,
): void {
    const previous = state.desired;
    const { controlledName, desired } = update;
    state.desired = desired;
    state.controlledName = controlledName;
    state.shouldRestoreFallback = previous !== null && desired === null;
    state.shouldReadFallback = shouldReadViewStackFallback(previous, desired, update);

    if (typeof update.nextFallback === "boolean") {
        state.fallback = update.nextFallback;
    }
}

function controlledViewStackName(value: unknown): string | null {
    if (value === undefined || value === null) {
        return null;
    }

    if (typeof value !== "string") {
        throw new TypeError("visibleChildName must be a string when provided");
    }

    return value;
}

function shouldReadViewStackFallback(
    previous: readonly ViewStackPageTransition[] | null,
    desired: readonly ViewStackPageTransition[] | null,
    update: ViewStackTransitionsUpdate,
): boolean {
    const isControlStarting = previous === null && desired !== null;

    return typeof update.nextFallback !== "boolean" &&
        (isControlStarting || typeof update.previousFallback === "boolean");
}

function assertPageTransitions(stack: Adw.ViewStack, entries: readonly ViewStackPageTransition[]): void {
    if (entries.some((entry) => stack.getChildByName(entry.name) === null)) {
        throw new Error("pageTransitions names must belong to the view stack");
    }
}

function isPageTransitionEnabled(state: ViewStackTransitionsState, name: string | null): boolean {
    return state.desired?.find((entry) => entry.name === name)?.animateTransitions ?? state.fallback;
}

function setPageTransition(
    stack: Adw.ViewStack,
    state: ViewStackTransitionsState,
    name: string | null,
    shouldApplyFallback: boolean,
): void {
    if (!shouldApplyFallback && state.desired === null) {
        return;
    }

    const isEnabled = isPageTransitionEnabled(state, name);

    if (stack.getEnableTransitions() !== isEnabled) {
        stack.setEnableTransitions(isEnabled);
    }
}

function applyPageTransition(
    stack: Adw.ViewStack,
    state: ViewStackTransitionsState,
    shouldApplyFallback = false,
    name = stack.getVisibleChildName(),
): void {
    applyMutation(() => {
        setPageTransition(stack, state, name, shouldApplyFallback);
    });
}

function applyViewStackSettlement(
    stack: Adw.ViewStack,
    state: ViewStackTransitionsState,
    settlement: ViewStackSettlement,
): void {
    setPageTransition(stack, state, settlement.transitionName, settlement.shouldApplyFallback);

    if (
        settlement.canSetVisible &&
        settlement.controlledName !== null &&
        stack.getVisibleChildName() !== settlement.controlledName
    ) {
        stack.setVisibleChildName(settlement.controlledName);
    }
}

function settleControlledViewStack(
    stack: Adw.ViewStack,
    state: ViewStackTransitionsState,
    shouldApplyFallback = false,
): void {
    const controlledName = state.controlledName;
    const canSetVisible = controlledName !== null && stack.getChildByName(controlledName) !== null;
    const transitionName = canSetVisible ? controlledName : stack.getVisibleChildName();

    applyMutation(() => {
        applyViewStackSettlement(stack, state, {
            controlledName,
            canSetVisible,
            transitionName,
            shouldApplyFallback,
        });
    });
}

function scheduleControlledPageTransition(stack: Adw.ViewStack, state: ViewStackTransitionsState): void {
    if (state.isScheduled || (state.controlledName === null && state.desired === null)) {
        return;
    }

    state.isScheduled = true;

    queueMicrotask(() => {
        state.isScheduled = false;

        if (state.disconnect !== null) {
            runWithErrorReporter(state.reportError, () => {
                settleControlledViewStack(stack, state);
            });
        }
    });
}

function watchViewStackTransitions(stack: Adw.ViewStack, state: ViewStackTransitionsState): void {
    if (state.disconnect !== null) {
        return;
    }

    const onVisibleChildChanged = (): void => {
        runWithErrorReporter(state.reportError, () => {
            applyPageTransition(stack, state);
            scheduleControlledPageTransition(stack, state);
        });
    };

    const onTransitionPolicyChanged = (): void => {
        scheduleControlledPageTransition(stack, state);
    };

    stack.on("notify::visible-child-name", onVisibleChildChanged);
    stack.on("notify::enable-transitions", onTransitionPolicyChanged);

    state.disconnect = (): void => {
        stack.off("notify::visible-child-name", onVisibleChildChanged);
        stack.off("notify::enable-transitions", onTransitionPolicyChanged);
    };
}

function getSlotId(name: string): string | null {
    if (name.length <= SLOT_SUFFIX.length || !name.endsWith(SLOT_SUFFIX)) {
        return null;
    }

    return name.slice(0, -SLOT_SUFFIX.length);
}

registerElements(BUILTIN_ELEMENTS);
registerElements(BUILTIN_BEHAVIORS);
