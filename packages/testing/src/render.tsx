import { getCurrentApp, getInterface, start, stop } from "@gtkx/ffi";
import type { AccessibleRole } from "@gtkx/ffi/gtk";
import * as Gtk from "@gtkx/ffi/gtk";
import { ApplicationWindow, ROOT_NODE_CONTAINER, reconciler } from "@gtkx/react";
import type { ReactNode } from "react";
import type Reconciler from "react-reconciler";
import * as queries from "./queries.js";
import { setScreenRoot } from "./screen.js";
import { tick } from "./timing.js";
import type { ByRoleOptions, RenderOptions, RenderResult, TextMatchOptions } from "./types.js";
import { hasLabel } from "./widget.js";

const APP_ID = "com.gtkx.testing";

let container: Reconciler.FiberRoot | null = null;

const getWidgetLabel = (widget: Gtk.Widget): string | null => {
    if (!hasLabel(widget)) return null;

    const role = getInterface(widget, Gtk.Accessible).getAccessibleRole();
    if (role === Gtk.AccessibleRole.LABEL) {
        return getInterface(widget, Gtk.Label).getLabel();
    }
    return getInterface(widget, Gtk.Button).getLabel();
};

const printWidgetTree = (root: Gtk.Widget, indent = 0): string => {
    const prefix = "  ".repeat(indent);
    const role = Gtk.AccessibleRole[getInterface(root, Gtk.Accessible).getAccessibleRole()] ?? "UNKNOWN";
    const labelText = getWidgetLabel(root);
    const label = labelText ? ` label="${labelText}"` : "";
    let result = `${prefix}<${root.constructor.name} role=${role}${label}>\n`;

    let child = root.getFirstChild();
    while (child) {
        result += printWidgetTree(child, indent + 1);
        child = child.getNextSibling();
    }

    return result;
};

type ReconcilerInstance = ReturnType<typeof reconciler.getInstance>;

const update = async (
    instance: ReconcilerInstance,
    element: ReactNode,
    fiberRoot: Reconciler.FiberRoot,
): Promise<void> => {
    instance.updateContainer(element, fiberRoot, null, () => {});
    await tick();
};

const ensureInitialized = (): { app: Gtk.Application; container: Reconciler.FiberRoot } => {
    const app = start(APP_ID);

    if (!container) {
        const instance = reconciler.getInstance();
        container = instance.createContainer(
            ROOT_NODE_CONTAINER,
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

const DefaultWrapper = ({ children }: { children: ReactNode }): ReactNode => (
    <ApplicationWindow>{children}</ApplicationWindow>
);

const wrapElement = (element: ReactNode, wrapper: RenderOptions["wrapper"] = true): ReactNode => {
    if (wrapper === false) return element;
    if (wrapper === true) return <DefaultWrapper>{element}</DefaultWrapper>;
    const Wrapper = wrapper;
    return <Wrapper>{element}</Wrapper>;
};

/**
 * Renders a React element into a GTK application for testing.
 * @param element - The React element to render
 * @param options - Render options including wrapper component
 * @returns Object containing query methods, container, and utility functions
 */
export const render = async (element: ReactNode, options?: RenderOptions): Promise<RenderResult> => {
    const { app: application, container: fiberRoot } = ensureInitialized();
    const instance = reconciler.getInstance();

    const wrappedElement = wrapElement(element, options?.wrapper);
    await update(instance, wrappedElement, fiberRoot);

    setScreenRoot(application);

    return {
        container: application,
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
        unmount: () => update(instance, null, fiberRoot),
        rerender: (newElement: ReactNode) => {
            const wrapped = wrapElement(newElement, options?.wrapper);
            return update(instance, wrapped, fiberRoot);
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
export const cleanup = async (): Promise<void> => {
    if (container) {
        const app = getCurrentApp();
        const instance = reconciler.getInstance();
        await update(instance, null, container);
        for (const window of app.getWindows()) {
            window.destroy();
        }
    }
    container = null;
    setScreenRoot(null);
};

/**
 * Tears down the testing environment by cleaning up and stopping GTK.
 * Can be used as global teardown in your test runner configuration.
 */
export const teardown = async (): Promise<void> => {
    await cleanup();
    stop();
};
