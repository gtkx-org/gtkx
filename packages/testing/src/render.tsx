import { discardAllBatches, start } from "@gtkx/ffi";
import * as Gio from "@gtkx/ffi/gio";
import type * as Gtk from "@gtkx/ffi/gtk";
import { ApplicationContext, GtkApplicationWindow, reconciler } from "@gtkx/react";
import type { ReactNode } from "react";
import type Reconciler from "react-reconciler";
import { bindQueries } from "./bind-queries.js";
import { prettyWidget } from "./pretty-widget.js";
import { setScreenRoot } from "./screen.js";
import { tick } from "./timing.js";
import type { RenderOptions, RenderResult } from "./types.js";

let application: Gtk.Application | null = null;
let container: Reconciler.FiberRoot | null = null;
let lastRenderError: Error | null = null;

type ReconcilerInstance = ReturnType<typeof reconciler.getInstance>;

const update = async (
    instance: ReconcilerInstance,
    element: ReactNode,
    fiberRoot: Reconciler.FiberRoot,
): Promise<void> => {
    lastRenderError = null;
    instance.updateContainer(element, fiberRoot, null, () => {});
    await tick();

    if (lastRenderError) {
        const error = lastRenderError;
        lastRenderError = null;
        throw error;
    }
};

const handleError = (error: Error): void => {
    discardAllBatches();
    lastRenderError = error;
};

const ensureInitialized = (): { app: Gtk.Application; container: Reconciler.FiberRoot } => {
    application = start("org.gtkx.testing", Gio.ApplicationFlags.NON_UNIQUE);

    if (!container) {
        const instance = reconciler.getInstance();
        container = instance.createContainer(
            application,
            1,
            null,
            false,
            null,
            "",
            handleError,
            handleError,
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

/**
 * Renders a React element for testing.
 *
 * Creates a GTK application context and renders the element, returning
 * query methods and utilities for interacting with the rendered widgets.
 *
 * @param element - The React element to render
 * @param options - Render options including wrapper configuration
 * @returns A promise resolving to query methods and utilities
 *
 * @example
 * ```tsx
 * import { render, screen } from "@gtkx/testing";
 *
 * test("button click", async () => {
 *   await render(<MyButton />);
 *   const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON);
 *   await userEvent.click(button);
 * });
 * ```
 *
 * @see {@link cleanup} for cleaning up after tests
 * @see {@link screen} for global query access
 */
export const render = async (element: ReactNode, options?: RenderOptions): Promise<RenderResult> => {
    const { app: application, container: fiberRoot } = ensureInitialized();
    const instance = reconciler.getInstance();

    const wrappedElement = wrapElement(element, options?.wrapper);
    const withContext = <ApplicationContext.Provider value={application}>{wrappedElement}</ApplicationContext.Provider>;
    await update(instance, withContext, fiberRoot);

    setScreenRoot(application);

    return {
        container: application,
        ...bindQueries(application),
        unmount: () => update(instance, null, fiberRoot),
        rerender: (newElement: ReactNode) => {
            const wrapped = wrapElement(newElement, options?.wrapper);
            const withCtx = <ApplicationContext.Provider value={application}>{wrapped}</ApplicationContext.Provider>;
            return update(instance, withCtx, fiberRoot);
        },
        debug: () => {
            console.log(prettyWidget(application));
        },
    };
};

/**
 * Cleans up the rendered component tree.
 *
 * Unmounts all rendered components and resets the testing environment.
 * Call this in `afterEach` to ensure tests don't affect each other.
 *
 * @example
 * ```tsx
 * import { render, cleanup } from "@gtkx/testing";
 *
 * afterEach(async () => {
 *   await cleanup();
 * });
 *
 * test("my test", async () => {
 *   await render(<MyComponent />);
 *   // ...
 * });
 * ```
 */
export const cleanup = async (): Promise<void> => {
    if (container && application) {
        const instance = reconciler.getInstance();
        await update(instance, null, container);
    }
    container = null;
    setScreenRoot(null);
};
