import { start, stop } from "@gtkx/ffi";
import type { Accessible, AccessibleRole } from "@gtkx/ffi/gtk";
import * as Gtk from "@gtkx/ffi/gtk";
import { reconciler } from "@gtkx/react";
import type { ReactNode } from "react";
import type Reconciler from "react-reconciler";
import * as queries from "./queries.js";
import { setScreenRoot } from "./screen.js";
import type { ByRoleOptions, RenderOptions, RenderResult, TextMatchOptions } from "./types.js";

const APP_ID = "com.gtkx.testing";

let app: Gtk.Application | null = null;
let container: Reconciler.FiberRoot | null = null;

type WidgetWithLabel = { getLabel: () => string | null };

const hasGetLabel = (widget: unknown): widget is WidgetWithLabel =>
    typeof (widget as WidgetWithLabel).getLabel === "function";

const printWidgetTree = (root: Gtk.Widget, indent = 0): string => {
    const accessible = root as unknown as Accessible;
    const prefix = "  ".repeat(indent);
    const role = Gtk.AccessibleRole[accessible.getAccessibleRole()] ?? "UNKNOWN";
    const label = hasGetLabel(root) ? ` label="${root.getLabel()}"` : "";
    let result = `${prefix}<${root.constructor.name} role=${role}${label}>\n`;

    let child = root.getFirstChild();
    while (child) {
        result += printWidgetTree(child, indent + 1);
        child = child.getNextSibling();
    }

    return result;
};

type ReconcilerInstance = ReturnType<typeof reconciler.getInstance>;

const updateSync = (instance: ReconcilerInstance, element: ReactNode, fiberRoot: Reconciler.FiberRoot): void => {
    const instanceAny = instance as unknown as Record<string, unknown>;

    if (typeof instanceAny.flushSync === "function") {
        (instanceAny.flushSync as (fn: () => void) => void)(() => {
            instance.updateContainer(element, fiberRoot, null, () => {});
        });
    } else {
        if (typeof instanceAny.updateContainerSync === "function") {
            (instanceAny.updateContainerSync as typeof instance.updateContainer)(element, fiberRoot, null, () => {});
        } else {
            instance.updateContainer(element, fiberRoot, null, () => {});
        }
        if (typeof instanceAny.flushSyncWork === "function") {
            (instanceAny.flushSyncWork as () => void)();
        }
    }

    instance.flushPassiveEffects();
};

const ensureInitialized = (): { app: Gtk.Application; container: Reconciler.FiberRoot } => {
    if (!app) {
        try {
            app = reconciler.getApp();
        } catch {
            app = start(APP_ID);
            reconciler.setApp(app);
        }
    }

    if (!container) {
        const instance = reconciler.getInstance();
        container = instance.createContainer(
            app,
            0,
            null,
            false,
            null,
            "",
            (error: Error) => console.error("Test reconciler error:", error),
            () => {},
            () => {},
            () => {},
            null,
        );
    }

    return { app, container };
};

const wrapElement = (element: ReactNode, Wrapper?: RenderOptions["wrapper"]): ReactNode => {
    if (!Wrapper) return element;
    return <Wrapper>{element}</Wrapper>;
};

/**
 * Renders a React element into a GTK application for testing.
 * @param element - The React element to render
 * @param options - Render options including wrapper component
 * @returns Object containing query methods, container, and utility functions
 */
export const render = (element: ReactNode, options?: RenderOptions): RenderResult => {
    const { app: application, container: fiberRoot } = ensureInitialized();
    const instance = reconciler.getInstance();

    const wrappedElement = wrapElement(element, options?.wrapper);
    updateSync(instance, wrappedElement, fiberRoot);

    setScreenRoot(application);

    return {
        container: application,
        getByRole: (role: AccessibleRole, opts?: ByRoleOptions) => queries.getByRole(application, role, opts),
        getByLabelText: (text: string | RegExp, opts?: TextMatchOptions) =>
            queries.getByLabelText(application, text, opts),
        getByText: (text: string | RegExp, opts?: TextMatchOptions) => queries.getByText(application, text, opts),
        getByTestId: (testId: string | RegExp, opts?: TextMatchOptions) =>
            queries.getByTestId(application, testId, opts),
        queryByRole: (role: AccessibleRole, opts?: ByRoleOptions) => queries.queryByRole(application, role, opts),
        queryByLabelText: (text: string | RegExp, opts?: TextMatchOptions) =>
            queries.queryByLabelText(application, text, opts),
        queryByText: (text: string | RegExp, opts?: TextMatchOptions) => queries.queryByText(application, text, opts),
        queryByTestId: (testId: string | RegExp, opts?: TextMatchOptions) =>
            queries.queryByTestId(application, testId, opts),
        getAllByRole: (role: AccessibleRole, opts?: ByRoleOptions) => queries.getAllByRole(application, role, opts),
        getAllByLabelText: (text: string | RegExp, opts?: TextMatchOptions) =>
            queries.getAllByLabelText(application, text, opts),
        getAllByText: (text: string | RegExp, opts?: TextMatchOptions) => queries.getAllByText(application, text, opts),
        getAllByTestId: (testId: string | RegExp, opts?: TextMatchOptions) =>
            queries.getAllByTestId(application, testId, opts),
        queryAllByRole: (role: AccessibleRole, opts?: ByRoleOptions) => queries.queryAllByRole(application, role, opts),
        queryAllByLabelText: (text: string | RegExp, opts?: TextMatchOptions) =>
            queries.queryAllByLabelText(application, text, opts),
        queryAllByText: (text: string | RegExp, opts?: TextMatchOptions) =>
            queries.queryAllByText(application, text, opts),
        queryAllByTestId: (testId: string | RegExp, opts?: TextMatchOptions) =>
            queries.queryAllByTestId(application, testId, opts),
        findByRole: (role: AccessibleRole, opts?: ByRoleOptions) => queries.findByRole(application, role, opts),
        findByLabelText: (text: string | RegExp, opts?: TextMatchOptions) =>
            queries.findByLabelText(application, text, opts),
        findByText: (text: string | RegExp, opts?: TextMatchOptions) => queries.findByText(application, text, opts),
        findByTestId: (testId: string | RegExp, opts?: TextMatchOptions) =>
            queries.findByTestId(application, testId, opts),
        findAllByRole: (role: AccessibleRole, opts?: ByRoleOptions) => queries.findAllByRole(application, role, opts),
        findAllByLabelText: (text: string | RegExp, opts?: TextMatchOptions) =>
            queries.findAllByLabelText(application, text, opts),
        findAllByText: (text: string | RegExp, opts?: TextMatchOptions) =>
            queries.findAllByText(application, text, opts),
        findAllByTestId: (testId: string | RegExp, opts?: TextMatchOptions) =>
            queries.findAllByTestId(application, testId, opts),
        unmount: () => updateSync(instance, null, fiberRoot),
        rerender: (newElement: ReactNode) => {
            const wrapped = wrapElement(newElement, options?.wrapper);
            updateSync(instance, wrapped, fiberRoot);
        },
        debug: () => {
            const activeWindow = application.getActiveWindow();
            if (activeWindow) {
                console.log(printWidgetTree(activeWindow));
            }
        },
    };
};

/**
 * Cleans up the rendered component by unmounting it and destroying windows.
 * Should be called after each test to reset state.
 */
export const cleanup = (): void => {
    if (container && app) {
        const instance = reconciler.getInstance();
        updateSync(instance, null, container);
        for (const window of app.getWindows()) {
            window.destroy();
        }
    }
    container = null;
    setScreenRoot(null);
};

/**
 * Tears down the testing environment by cleaning up and stopping GTK.
 * Used as global teardown in vitest configuration.
 */
export const teardown = (): void => {
    if (app) {
        cleanup();
        stop();
        app = null;
        container = null;
    }
};
