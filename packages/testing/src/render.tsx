import * as Gtk from "@gtkx/gi/gtk";
import { isRootElement, type RootElement, reconciler, setReconcilerErrorHandler } from "@gtkx/react";
import { type ErrorInfo, type ReactNode, StrictMode } from "react";
import type Reconciler from "react-reconciler";
import { bindQueries } from "./bind-queries.js";
import { logWidget, type PrettyWidgetOptions } from "./pretty-widget.js";
import { setScreenRoot } from "./screen.js";
import { act } from "./timing.js";
import { type Container, TOPLEVELS, traverse } from "./traversal.js";
import type { QueryMap, RenderOptions, RenderResult } from "./types.js";
import { resetClipboard } from "./user-event.js";

let lastRenderError: Error | null = null;
let errorHandlerInstalled = false;

type ActiveRender = {
    root: Reconciler.FiberRoot;
    window: Gtk.Window | null;
};

const activeRenders = new Set<ActiveRender>();

const HARNESS_WINDOW_WIDTH = 800;
const HARNESS_WINDOW_HEIGHT = 600;

const update = async (element: ReactNode, fiberRoot: Reconciler.FiberRoot): Promise<void> => {
    await act(() => {
        reconciler.updateContainer(element, fiberRoot, null, () => {});
    });

    if (lastRenderError) {
        const captured = lastRenderError;
        lastRenderError = null;
        throw captured;
    }
};

const handleError = (error: unknown): void => {
    lastRenderError = error instanceof Error ? error : new Error(String(error));
};

const installErrorHandler = (): void => {
    if (errorHandlerInstalled) return;
    setReconcilerErrorHandler(handleError);
    errorHandlerInstalled = true;
};

type ResolvedContainer = {
    containerInfo: Gtk.Widget | RootElement;
    window: Gtk.Window | null;
};

const resolveContainer = (container: RenderOptions["container"]): ResolvedContainer => {
    if (isRootElement(container)) {
        return { containerInfo: container, window: null };
    }
    if (container instanceof Gtk.Widget) {
        return { containerInfo: container, window: null };
    }
    const window = new Gtk.Window({ defaultWidth: HARNESS_WINDOW_WIDTH, defaultHeight: HARNESS_WINDOW_HEIGHT });
    return { containerInfo: window, window };
};

const firstWidget = (baseElement: Container): Gtk.Widget => {
    if (baseElement instanceof Gtk.Widget) return baseElement;
    for (const widget of traverse(baseElement)) return widget;
    throw new Error("render() produced no widgets: ensure the element renders visible content");
};

const resultContainer = (
    resolved: ResolvedContainer,
    container: RenderOptions["container"],
    baseElement: Container,
): Gtk.Widget => {
    if (resolved.window) return resolved.window;
    if (container instanceof Gtk.Widget) return container;
    return firstWidget(baseElement);
};

/**
 * Renders a React element for testing.
 *
 * Mounts the element into a fresh, presented `Gtk.Window` by default — the
 * GTK analogue of Testing Library's default container — so a component renders
 * into a real window queries and screenshots can reach. Pass `container` to
 * change the mount: a specific widget to render into it, or a token from
 * {@link createRootElement} to render a top-level element (a `GtkApplication`/
 * `AdwApplication` or a window) directly at the reconciler root with no host
 * window. A user `wrapper` is applied around the element and re-applied on every
 * `rerender`.
 *
 * The harness owns no application: a component that needs one renders its own
 * (with `container: createRootElement()`) or supplies it through a `wrapper`.
 *
 * @param element - The React element to render
 * @param options - Render options: `container`, `baseElement`, and `wrapper`
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
 * @example
 * ```tsx
 * import { createRootElement, render } from "@gtkx/testing";
 *
 * test("renders its own application", async () => {
 *   await render(<MyApp />, { container: createRootElement() });
 * });
 * ```
 *
 * @see {@link cleanup} for cleaning up after tests
 * @see {@link screen} for global query access
 */
export const render = async <Q extends QueryMap = Record<never, never>>(
    element: ReactNode,
    options?: RenderOptions<Q>,
): Promise<RenderResult<Q>> => {
    installErrorHandler();

    const baseElement: Container = options?.baseElement ?? TOPLEVELS;
    const Wrapper = options?.wrapper;

    const onCaughtError = (error: unknown, errorInfo: ErrorInfo): void => {
        handleError(error);
        options?.onCaughtError?.(error, errorInfo);
    };
    const onRecoverableError = (error: unknown, errorInfo: ErrorInfo): void => {
        options?.onRecoverableError?.(error, errorInfo);
    };

    const resolved = resolveContainer(options?.container);
    const fiberRoot = reconciler.createContainer(
        resolved.containerInfo,
        1,
        null,
        false,
        null,
        "",
        handleError,
        onCaughtError,
        onRecoverableError,
        () => {},
    );
    const active: ActiveRender = { root: fiberRoot, window: resolved.window };
    activeRenders.add(active);

    const wrap = (node: ReactNode): ReactNode => {
        const wrapped = Wrapper ? <Wrapper>{node}</Wrapper> : node;
        return options?.reactStrictMode ? <StrictMode>{wrapped}</StrictMode> : wrapped;
    };

    await update(wrap(element), fiberRoot);
    resolved.window?.present();

    setScreenRoot(baseElement);

    return {
        ...bindQueries(baseElement, options?.queries),
        get container(): Gtk.Widget {
            return resultContainer(resolved, options?.container, baseElement);
        },
        baseElement,
        unmount: async () => {
            if (!activeRenders.delete(active)) return;
            await update(null, fiberRoot);
            resolved.window?.destroy();
        },
        rerender: async (newElement: ReactNode) => {
            await update(wrap(newElement), fiberRoot);
        },
        debug: (element: Container | Container[] = baseElement, options?: PrettyWidgetOptions) => {
            logWidget(element, options);
        },
    };
};

/**
 * Cleans up the rendered component tree.
 *
 * Unmounts every tree rendered since the last cleanup and destroys the host
 * windows the harness created for them. Call this in `afterEach` to ensure
 * tests don't affect each other.
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
 * });
 * ```
 */
export const cleanup = async (): Promise<void> => {
    for (const active of activeRenders) {
        await update(null, active.root);
        active.window?.destroy();
    }
    activeRenders.clear();
    setScreenRoot(null);
    resetClipboard();
};
