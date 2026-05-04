import { initRuntime, stop } from "@gtkx/ffi";
import * as Gio from "@gtkx/ffi/gio";
import * as Gtk from "@gtkx/ffi/gtk";
import { ApplicationContext, GtkApplicationWindow, reconciler } from "@gtkx/react";
import { createRef, type ReactNode, type Ref } from "react";
import type Reconciler from "react-reconciler";
import { bindQueries } from "./bind-queries.js";
import { prettyWidget } from "./pretty-widget.js";
import { setScreenRoot } from "./screen.js";
import { tick } from "./timing.js";
import { type Container, isApplication, traverse } from "./traversal.js";
import type { RenderOptions, RenderResult, WrapperComponent } from "./types.js";

let application: Gtk.Application | null = null;
let container: Reconciler.FiberRoot | null = null;
let lastRenderError: Error | null = null;

const update = async (element: ReactNode, fiberRoot: Reconciler.FiberRoot): Promise<void> => {
    lastRenderError = null;
    reconciler.updateContainer(element, fiberRoot, null, () => {});
    await tick();

    if (lastRenderError) {
        const error = lastRenderError;
        lastRenderError = null;
        throw error;
    }
};

const handleError = (error: Error): void => {
    lastRenderError = error;
};

const ensureInitialized = (): { app: Gtk.Application; container: Reconciler.FiberRoot } => {
    if (!application) {
        initRuntime();
        application = new Gtk.Application(Gio.ApplicationFlags.NON_UNIQUE, "org.gtkx.testing");
        application.register(null);
        application.activate();
    }

    if (!container) {
        container = reconciler.createContainer(
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
        );
    }

    return { app: application, container };
};

const DefaultWrapper: WrapperComponent = ({ children, ref }) => (
    <GtkApplicationWindow ref={ref as Ref<Gtk.ApplicationWindow>} defaultWidth={800} defaultHeight={600}>
        {children}
    </GtkApplicationWindow>
);

const findFirstWidget = (root: Container): Gtk.Widget | null => {
    if (!isApplication(root)) return root;
    const iterator = traverse(root)[Symbol.iterator]();
    const first = iterator.next();
    return first.done ? null : first.value;
};

const wrapElement = (
    element: ReactNode,
    wrapperRef: React.RefObject<Gtk.Widget | null>,
    wrapper: RenderOptions["wrapper"],
): ReactNode => {
    if (wrapper === false || wrapper === undefined) return element;
    const Wrapper = wrapper === true ? DefaultWrapper : wrapper;
    return <Wrapper ref={wrapperRef}>{element}</Wrapper>;
};

const resolveContainer = (
    wrapper: RenderOptions["wrapper"],
    wrapperRef: React.RefObject<Gtk.Widget | null>,
    baseElement: Container,
): Gtk.Widget => {
    if (wrapper !== false && wrapper !== undefined && wrapperRef.current) {
        return wrapperRef.current;
    }
    const firstWidget = findFirstWidget(baseElement);
    if (!firstWidget) {
        throw new Error("render() produced no widgets: ensure the element renders visible content");
    }
    return firstWidget;
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
 * await render(<MyButton />);
 * const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON);
 * await userEvent.click(button);
 * });
 * ```
 *
 * @see {@link cleanup} for cleaning up after tests
 * @see {@link screen} for global query access
 */
export const render = async (element: ReactNode, options?: RenderOptions): Promise<RenderResult> => {
    const { app: application, container: fiberRoot } = ensureInitialized();
    const baseElement: Container = options?.baseElement ?? application;
    const wrapper = options?.wrapper ?? true;

    const wrapperRef = createRef<Gtk.Widget>();
    const wrappedElement = wrapElement(element, wrapperRef, wrapper);
    const withContext = <ApplicationContext.Provider value={application}>{wrappedElement}</ApplicationContext.Provider>;
    await update(withContext, fiberRoot);

    setScreenRoot(application);

    return {
        container: resolveContainer(wrapper, wrapperRef, baseElement),
        baseElement,
        ...bindQueries(baseElement),
        unmount: () => update(null, fiberRoot),
        rerender: async (newElement: ReactNode) => {
            const newWrapperRef = createRef<Gtk.Widget>();
            const wrapped = wrapElement(newElement, newWrapperRef, wrapper);
            const withCtx = <ApplicationContext.Provider value={application}>{wrapped}</ApplicationContext.Provider>;
            await update(withCtx, fiberRoot);
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
 * await cleanup();
 * });
 *
 * test("my test", async () => {
 * await render(<MyComponent />);
 * // ...
 * });
 * ```
 */
export const cleanup = async (): Promise<void> => {
    if (container && application) {
        await update(null, container);
    }
    container = null;
    setScreenRoot(null);
};

const handleSignal = (): void => {
    try {
        stop();
    } catch {}
    process.exit(0);
};

process.on("SIGTERM", handleSignal);
process.on("SIGINT", handleSignal);
