import type { CaughtErrorInfo, Root, RootElement } from "@gtkx/react";
import * as Gtk from "@gtkx/gi/gtk";
import { createRoot } from "@gtkx/react";
import { isRootElement, settleAccessible } from "@gtkx/react/internal";
import { type ErrorInfo, type ReactNode, StrictMode } from "react";
import type { RenderResult } from "./bound-queries.js";
import type { QueryMap, RenderOptions, ScreenshotOptions } from "./types.js";
import { runInAct, runWithActEnvironment } from "./act.js";
import { addToCleanupQueue, runCleanup, runCleanupCallbacks } from "./cleanup-registry.js";
import { getConfig } from "./config.js";
import { scheduleWhenWindowReady } from "./frame-sync.js";
import { createHarnessWindow, presentHarnessWindow } from "./harness-window.js";
import { logWidget, type PrettyWidgetOptions } from "./pretty-widget.js";
import { logRoles } from "./role-helpers.js";
import { clearScreen, setScreen } from "./screen.js";
import { captureScreen } from "./screenshot.js";
import { type Container, roots, TOPLEVELS } from "./traversal.js";
import { resetClipboard } from "./user-event/index.js";
import { requireWidget } from "./widget-target.js";
import { findPresentedWindowFailure, findRenderedWindowFailure, mappedToplevels } from "./window-state.js";
import { within } from "./within.js";

type ActiveRender = {
    root: Root;
    window: Gtk.Window | null;
    errors: RenderErrorState;
};

type ResolvedContainer = {
    containerInfo: Gtk.Widget | RootElement;
    window: Gtk.Window | null;
};

type RenderErrorState = {
    lastError: Error | null;
};

type WindowFailureReporter = (window: Gtk.Window) => string | null;
type SettleAction = "render" | "rerender";

const activeRenders: Set<ActiveRender> = new Set();

const settleWindow = async (
    window: Gtk.Window | null,
    findFailure: WindowFailureReporter,
    action: SettleAction,
): Promise<void> => {
    const timeout = getConfig().windowActivationTimeout;

    await runWithActEnvironment(
        false,
        () =>
            new Promise<void>((resolve) => {
                scheduleWhenWindowReady(window, (target) => findFailure(target) === null, timeout, resolve);
            }),
    );

    settleAccessible();
    const failure = window === null ? null : findFailure(window);

    if (failure !== null) {
        throw new Error(
            `${action} timed out after ${String(timeout)}ms waiting for the window it rendered into: ${failure}. ` +
            "Platform state such as focus is only readable once that window is allocated and active.",
        );
    }
};

const flushRender = async (active: ActiveRender, action: () => void): Promise<void> => {
    try {
        await runInAct(async () => {
            action();
            await Promise.resolve();
        });

        if (active.errors.lastError !== null) {
            throw active.errors.lastError;
        }
    } finally {
        active.errors.lastError = null;
    }
};

const disposeActiveRender = async (active: ActiveRender): Promise<void> => {
    if (!activeRenders.delete(active)) {
        return;
    }

    try {
        await flushRender(active, active.root.unmount);
    } finally {
        active.window?.destroy();
    }
};

const disposeAllActiveRenders = async (): Promise<void> => {
    await runCleanupCallbacks(activeRenders.values().map((active) => () => disposeActiveRender(active)));
};

const resolveContainer = (container: RenderOptions["container"]): ResolvedContainer => {
    if (isRootElement(container)) {
        return { containerInfo: container, window: null };
    }

    if (container instanceof Gtk.Widget) {
        return { containerInfo: container, window: null };
    }

    if (container !== undefined) {
        requireWidget(container);
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

const renderErrorHandlers = <Q extends QueryMap>(errors: RenderErrorState, options: RenderOptions<Q> | undefined) => {
    const handleError = (error: unknown): void => {
        errors.lastError = error instanceof Error ? error : new Error(String(error));
    };

    return {
        onUncaughtError: handleError,
        onCaughtError: (error: unknown, errorInfo: CaughtErrorInfo): void => {
            handleError(error);
            options?.onCaughtError?.(error, errorInfo);
        },
        onRecoverableError: (error: unknown, errorInfo: ErrorInfo): void => {
            options?.onRecoverableError?.(error, errorInfo);
        },
    };
};

const applyEnableAnimations = (areAnimationsEnabled: boolean): void => {
    const settings = Gtk.Settings.getDefault();

    if (settings) {
        settings.gtkEnableAnimations = areAnimationsEnabled;
    }
};

/**
 * Renders React into native widgets and returns queries, debug helpers, and lifecycle controls.
 *
 * @remarks
 * Without a container, creates and presents a harness window. Its initially focused editable
 * keeps its text unselected, with the caret at the end.
 *
 * Waits for layout and activation before resolving, so focus and other platform state can be
 * read immediately. A new harness waits for its own activation; a caller-owned or rendered
 * window waits for application activation, since only presentation can claim it. A container
 * that is not shown requires no activation wait.
 *
 * Widgets outside all toplevels or inside a hidden window cannot receive pointer or keyboard
 * input. `userEvent` rejects after `actionabilityTimeout`; use `fireEvent` to drive them directly.
 *
 * @param element React element to render.
 * @param options Container, wrapper, custom queries, and render settings.
 * @returns Bound queries, debug helpers, and rerender/unmount controls.
 * @throws If a shown window is not laid out and activated within `windowActivationTimeout`.
 */
const render = async <Q extends QueryMap = Record<never, never>>(
    element: ReactNode,
    options?: RenderOptions<Q>,
): Promise<RenderResult<Q>> => {
    applyEnableAnimations(options?.areAnimationsEnabled === true);
    const baseElement: Container = options?.baseElement ?? TOPLEVELS;
    const Wrapper = options?.wrapper;
    const resolved = resolveContainer(options?.container);

    const errors: RenderErrorState = { lastError: null };
    const root = createRoot(resolved.containerInfo, renderErrorHandlers(errors, options));

    const active: ActiveRender = { root, window: resolved.window, errors };
    activeRenders.add(active);
    addToCleanupQueue(disposeAllActiveRenders);
    addToCleanupQueue(clearScreen);
    addToCleanupQueue(resetClipboard);

    const wrap = (node: ReactNode): ReactNode => {
        const wrapped = Wrapper ? <Wrapper>{node}</Wrapper> : node;

        return options?.isReactStrictMode ? <StrictMode>{wrapped}</StrictMode> : wrapped;
    };

    await flushRender(active, () => {
        root.render(wrap(element));
    });
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
            await flushRender(active, () => {
                root.render(wrap(newElement));
            });
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
