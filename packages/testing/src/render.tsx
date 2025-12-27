import { getNativeObject, start } from "@gtkx/ffi";
import * as Gtk from "@gtkx/ffi/gtk";
import { ApplicationContext, GtkApplicationWindow, reconciler } from "@gtkx/react";
import type { ReactNode } from "react";
import type Reconciler from "react-reconciler";
import * as queries from "./queries.js";
import { setScreenRoot } from "./screen.js";
import { tick } from "./timing.js";
import type { ByRoleOptions, RenderOptions, RenderResult, TextMatch, TextMatchOptions } from "./types.js";
import { hasLabel } from "./widget.js";

let application: Gtk.Application | null = null;
let container: Reconciler.FiberRoot | null = null;

const APP_ID = `com.gtkx.test${process.pid}`;

const getWidgetLabel = (widget: Gtk.Widget): string | null => {
    if (!hasLabel(widget)) return null;

    const accessible = getNativeObject(widget.id, Gtk.Accessible);
    if (!accessible) return null;

    const role = accessible.getAccessibleRole();
    if (role === Gtk.AccessibleRole.LABEL) {
        return (widget as Gtk.Label).getLabel?.() ?? null;
    }
    return (widget as Gtk.Button).getLabel?.() ?? null;
};

const printWidgetTree = (root: Gtk.Widget, indent = 0): string => {
    const prefix = "  ".repeat(indent);
    const accessibleRole = getNativeObject(root.id, Gtk.Accessible)?.getAccessibleRole();
    const role = accessibleRole !== undefined ? (Gtk.AccessibleRole[accessibleRole] ?? "UNKNOWN") : "UNKNOWN";
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
    application = start(APP_ID);

    if (!container) {
        const instance = reconciler.getInstance();
        container = instance.createContainer(
            application,
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

    return { app: application, container };
};

const DefaultWrapper = ({ children }: { children: ReactNode }): ReactNode => (
    <GtkApplicationWindow>{children}</GtkApplicationWindow>
);

const wrapElement = (element: ReactNode, wrapper: RenderOptions["wrapper"] = true): ReactNode => {
    if (wrapper === false) return element;
    if (wrapper === true) return <DefaultWrapper>{element}</DefaultWrapper>;
    const Wrapper = wrapper;
    return <Wrapper>{element}</Wrapper>;
};

export const render = async (element: ReactNode, options?: RenderOptions): Promise<RenderResult> => {
    const { app: application, container: fiberRoot } = ensureInitialized();
    const instance = reconciler.getInstance();

    const wrappedElement = wrapElement(element, options?.wrapper);
    const withContext = <ApplicationContext.Provider value={application}>{wrappedElement}</ApplicationContext.Provider>;
    await update(instance, withContext, fiberRoot);

    setScreenRoot(application);

    return {
        container: application,
        findByRole: (role: Gtk.AccessibleRole, opts?: ByRoleOptions) => queries.findByRole(application, role, opts),
        findByLabelText: (text: TextMatch, opts?: TextMatchOptions) => queries.findByLabelText(application, text, opts),
        findByText: (text: TextMatch, opts?: TextMatchOptions) => queries.findByText(application, text, opts),
        findByTestId: (testId: TextMatch, opts?: TextMatchOptions) => queries.findByTestId(application, testId, opts),
        findAllByRole: (role: Gtk.AccessibleRole, opts?: ByRoleOptions) =>
            queries.findAllByRole(application, role, opts),
        findAllByLabelText: (text: TextMatch, opts?: TextMatchOptions) =>
            queries.findAllByLabelText(application, text, opts),
        findAllByText: (text: TextMatch, opts?: TextMatchOptions) => queries.findAllByText(application, text, opts),
        findAllByTestId: (testId: TextMatch, opts?: TextMatchOptions) =>
            queries.findAllByTestId(application, testId, opts),
        unmount: () => update(instance, null, fiberRoot),
        rerender: (newElement: ReactNode) => {
            const wrapped = wrapElement(newElement, options?.wrapper);
            const withCtx = <ApplicationContext.Provider value={application}>{wrapped}</ApplicationContext.Provider>;
            return update(instance, withCtx, fiberRoot);
        },
        debug: () => {
            const activeWindow = application.getActiveWindow();
            if (activeWindow) {
                console.log(printWidgetTree(activeWindow));
            }
        },
    };
};

export const cleanup = async (): Promise<void> => {
    if (container && application) {
        const instance = reconciler.getInstance();
        await update(instance, null, container);
    }
    container = null;
    setScreenRoot(null);
};

export const teardown = async (): Promise<void> => {
    await cleanup();
};
