import type { RootElement } from "@gtkx/react";
import * as Gtk from "@gtkx/gi/gtk";
import {
    createReconcilerRoot,
    isRootElement,
    type ReconcilerRoot,
    setReconcilerErrorHandler,
    settleAccessible,
} from "@gtkx/react/internal";
import { type ErrorInfo, type ReactNode, StrictMode } from "react";
import type { RenderResult } from "./bound-queries.js";
import type { QueryMap, RenderOptions, ScreenshotOptions } from "./types.js";
import { runInAct } from "./act.js";
import { addToCleanupQueue, runCleanup } from "./cleanup-registry.js";
import { getConfig } from "./config.js";
import { scheduleWhenWindowReady } from "./frame-sync.js";
import { createHarnessWindow, presentHarnessWindow } from "./harness-window.js";
import { logWidget, type PrettyWidgetOptions } from "./pretty-widget.js";
import { logRoles } from "./role-helpers.js";
import { clearScreen, setScreen } from "./screen.js";
import { captureScreen } from "./screenshot.js";
import { type Container, roots, TOPLEVELS } from "./traversal.js";
import { resetClipboard } from "./user-event/index.js";
import { findPresentedWindowFailure, findRenderedWindowFailure, mappedToplevels } from "./window-state.js";
import { within } from "./within.js";

/** A mounted render tracked so cleanup can unmount it. */
type ActiveRender = {
    /** Root that rerenders drive and that cleanup tears the tree down through. */
    root: ReconcilerRoot;
    /** Harness window created for the render, null when it renders into a container the caller supplied. */
    window: Gtk.Window | null;
};

type ResolvedContainer = {
    containerInfo: Gtk.Widget | RootElement;
    window: Gtk.Window | null;
};

type ReconcilerErrorState = {
    lastError: Error | null;
    isHandlerInstalled: boolean;
};

type WindowFailureReporter = (window: Gtk.Window) => string | null;
type SettleAction = "render" | "rerender";

const reconcilerErrors: ReconcilerErrorState = { lastError: null, isHandlerInstalled: false };
const activeRenders: Set<ActiveRender> = new Set();

const settleWindow = async (
    window: Gtk.Window | null,
    findFailure: WindowFailureReporter,
    action: SettleAction,
): Promise<void> => {
    const timeout = getConfig().windowActivationTimeout;

    await new Promise<void>((resolve) => {
        scheduleWhenWindowReady(window, (target) => findFailure(target) === null, timeout, resolve);
    });

    settleAccessible();
    const failure = window === null ? null : findFailure(window);

    if (failure !== null) {
        throw new Error(
            `${action} timed out after ${String(timeout)}ms waiting for the window it rendered into: ${failure}. ` +
            "Platform state such as focus is only readable once that window is allocated and active.",
        );
    }
};

const update = async (element: ReactNode, root: ReconcilerRoot): Promise<void> => {
    await runInAct(() => {
        root.update(element);
    });

    if (reconcilerErrors.lastError) {
        const captured = reconcilerErrors.lastError;
        reconcilerErrors.lastError = null;
        throw captured;
    }
};

const disposeActiveRender = async (active: ActiveRender): Promise<void> => {
    if (!activeRenders.delete(active)) {
        return;
    }

    await active.root.unmount(async (root) => {
        await update(null, root);
        active.window?.destroy();
    });
};

const disposeAllActiveRenders = async (): Promise<void> => {
    for (const active of activeRenders) {
        await disposeActiveRender(active);
    }
};

const handleError = (error: unknown): void => {
    reconcilerErrors.lastError = error instanceof Error ? error : new Error(String(error));
};

const installErrorHandler = (): void => {
    if (reconcilerErrors.isHandlerInstalled) {
        return;
    }

    setReconcilerErrorHandler(handleError);
    reconcilerErrors.isHandlerInstalled = true;
};

const resolveContainer = (container: RenderOptions["container"]): ResolvedContainer => {
    if (isRootElement(container)) {
        return { containerInfo: container, window: null };
    }

    if (container instanceof Gtk.Widget) {
        return { containerInfo: container, window: null };
    }

    const window = createHarnessWindow();
    window.setDecorated(false);

    return { containerInfo: window, window };
};

const firstToplevelWidget = (baseElement: Container): Gtk.Widget => {
    if (baseElement instanceof Gtk.Widget) {
        return baseElement;
    }

    const [first] = roots(baseElement);

    if (first) {
        return first;
    }

    throw new Error("render() produced no widgets: ensure the element renders visible content");
};

const resolveResultContainer = (
    resolved: ResolvedContainer,
    container: RenderOptions["container"],
    baseElement: Container,
): Gtk.Widget => {
    if (resolved.window) {
        return resolved.window;
    }

    if (container instanceof Gtk.Widget) {
        return container;
    }

    return firstToplevelWidget(baseElement);
};

const realizedWindow = (root: Gtk.Root | null): Gtk.Window | null =>
    root instanceof Gtk.Window && root.getFrameClock() !== null ? root : null;

const settleTarget = (resolved: ResolvedContainer, container: RenderOptions["container"]): Gtk.Window | null => {
    if (resolved.window) {
        return realizedWindow(resolved.window);
    }

    if (container instanceof Gtk.Widget) {
        return realizedWindow(container.getRoot());
    }

    return realizedWindow(mappedToplevels()[0] ?? null);
};

const settleRender = async (
    resolved: ResolvedContainer,
    container: RenderOptions["container"],
    action: SettleAction,
): Promise<void> => {
    const isPresentedNow = action === "render" && resolved.window !== null;
    const findFailure = isPresentedNow ? findPresentedWindowFailure : findRenderedWindowFailure;
    await settleWindow(settleTarget(resolved, container), findFailure, action);
};

const renderErrorHandlers = <Q extends QueryMap>(options: RenderOptions<Q> | undefined) => ({
    onUncaughtError: handleError,
    onCaughtError: (error: unknown, errorInfo: ErrorInfo): void => {
        handleError(error);
        options?.onCaughtError?.(error, errorInfo);
    },
    onRecoverableError: (error: unknown, errorInfo: ErrorInfo): void => {
        options?.onRecoverableError?.(error, errorInfo);
    },
});

const applyEnableAnimations = (areAnimationsEnabled: boolean): void => {
    const settings = Gtk.Settings.getDefault();

    if (settings) {
        settings.gtkEnableAnimations = areAnimationsEnabled;
    }
};

/**
 * Renders a React element into a GTK4 widget tree and returns queries
 * scoped to it along with controls for rerendering and unmounting. When no
 * container is supplied, a harness window is created and presented, and the editable it hands the
 * focus to keeps its text unselected, with its caret at the end. The returned promise settles once
 * the window the tree is shown in has been laid out and activation has arrived, so platform state
 * such as focus is already readable when it resolves. A presented harness window is waited on until
 * it is itself active; a window the caller or the tree owns is waited on until the application holds
 * activation, since only a present can claim it. Rendering into a container that is not shown waits
 * for nothing, and a window that never becomes readable within `windowActivationTimeout` throws an
 * error naming the condition that failed rather than resolving with unreadable platform state. A
 * tree mounted into a container that sits outside every toplevel, or inside a window that is not
 * visible, is out of reach of a pointer and a keyboard, so every `userEvent` helper aimed at it
 * rejects after `actionabilityTimeout` naming that condition, and `fireEvent` drives it instead.
 *
 * @param element The React element to render.
 * @param options Optional container, wrapper, custom queries, and other render settings.
 * @returns A render result with bound queries, debug helpers, and lifecycle controls.
 * @throws When the window the tree is shown in is not laid out and activated in time.
 */
const render = async <Q extends QueryMap = Record<never, never>>(
    element: ReactNode,
    options?: RenderOptions<Q>,
): Promise<RenderResult<Q>> => {
    installErrorHandler();
    applyEnableAnimations(options?.areAnimationsEnabled === true);
    const baseElement: Container = options?.baseElement ?? TOPLEVELS;
    const Wrapper = options?.wrapper;
    const resolved = resolveContainer(options?.container);

    const root = createReconcilerRoot({
        containerInfo: resolved.containerInfo,
        ...renderErrorHandlers(options),
    });

    const active: ActiveRender = { root, window: resolved.window };
    activeRenders.add(active);
    addToCleanupQueue(disposeAllActiveRenders);
    addToCleanupQueue(clearScreen);
    addToCleanupQueue(resetClipboard);

    const wrap = (node: ReactNode): ReactNode => {
        const wrapped = Wrapper ? <Wrapper>{node}</Wrapper> : node;

        return options?.isReactStrictMode ? <StrictMode>{wrapped}</StrictMode> : wrapped;
    };

    await update(wrap(element), root);
    presentHarnessWindow(resolved.window);
    await settleRender(resolved, options?.container, "render");
    const container = resolveResultContainer(resolved, options?.container, baseElement);

    const result: RenderResult<Q> = {
        ...within(baseElement, options?.queries),
        container,
        baseElement,
        unmount: async () => {
            await disposeActiveRender(active);
        },
        rerender: async (newElement: ReactNode) => {
            await update(wrap(newElement), root);
            await settleRender(resolved, options?.container, "rerender");
        },
        debug: (element: Container | Container[] = baseElement, debugOptions?: PrettyWidgetOptions) => {
            logWidget(element, debugOptions);
        },
        logRoles: () => {
            logRoles(baseElement);
        },
        screenshot: (screenshotOptions?: ScreenshotOptions) => captureScreen(screenshotOptions),
    };

    setScreen(result);

    return result;
};

/**
 * Unmounts every active render and runs all registered cleanup callbacks,
 * resetting the screen and clipboard. Called automatically after each test.
 */
const cleanup = async (): Promise<void> => {
    await runCleanup();
};

export { render, cleanup };
