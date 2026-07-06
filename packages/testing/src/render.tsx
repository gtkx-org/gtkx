import * as Gtk from "@gtkx/gi/gtk";
import type { RootElement } from "@gtkx/react";
import {
    createReconcilerRoot,
    isRootElement,
    type ReconcilerRoot,
    setReconcilerErrorHandler,
} from "@gtkx/react/internal";
import { type ErrorInfo, type ReactNode, StrictMode } from "react";
import { runInAct } from "./act.js";
import type { RenderResult } from "./bound-queries.js";
import { addToCleanupQueue, runCleanup } from "./cleanup-registry.js";
import { logWidget, type PrettyWidgetOptions } from "./pretty-widget.js";
import { logRoles } from "./role-helpers.js";
import { clearScreen, setScreen } from "./screen.js";
import { captureAndSaveScreenshot } from "./screenshot.js";
import { type Container, TOPLEVELS, traverse } from "./traversal.js";
import type { QueryMap, RenderOptions, ScreenshotOptions, WindowSelector } from "./types.js";
import { resetClipboard } from "./user-event/index.js";
import { within } from "./within.js";

let lastRenderError: Error | null = null;
let errorHandlerInstalled = false;

type ActiveRender = {
    root: ReconcilerRoot;
    window: Gtk.Window | null;
};

const activeRenders = new Set<ActiveRender>();

const HARNESS_WINDOW_WIDTH = 800;
const HARNESS_WINDOW_HEIGHT = 600;

const update = async (element: ReactNode, root: ReconcilerRoot): Promise<void> => {
    await runInAct(() => {
        root.update(element);
    });

    if (lastRenderError) {
        const captured = lastRenderError;
        lastRenderError = null;
        throw captured;
    }
};

const disposeActiveRender = async (active: ActiveRender): Promise<void> => {
    if (!activeRenders.delete(active)) return;
    await active.root.unmount(async (root) => {
        await update(null, root);
        active.window?.destroy();
    });
};

const disposeAllActiveRenders = async (): Promise<void> => {
    for (const active of [...activeRenders]) {
        await disposeActiveRender(active);
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
    window.setTitlebar(new Gtk.HeaderBar({ showTitleButtons: false }));
    return { containerInfo: window, window };
};

const firstToplevelWidget = (baseElement: Container): Gtk.Widget => {
    if (baseElement instanceof Gtk.Widget) return baseElement;
    const [first] = traverse(baseElement);
    if (first) return first;
    throw new Error("render() produced no widgets: ensure the element renders visible content");
};

const resolveResultContainer = (
    resolved: ResolvedContainer,
    container: RenderOptions["container"],
    baseElement: Container,
): Gtk.Widget => {
    if (resolved.window) return resolved.window;
    if (container instanceof Gtk.Widget) return container;
    return firstToplevelWidget(baseElement);
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

const applyEnableAnimations = (enabled: boolean): void => {
    const settings = Gtk.Settings.getDefault();
    if (settings) {
        settings.gtkEnableAnimations = enabled;
    }
};

export const render = async <Q extends QueryMap = Record<never, never>>(
    element: ReactNode,
    options?: RenderOptions<Q>,
): Promise<RenderResult<Q>> => {
    installErrorHandler();

    applyEnableAnimations(options?.animations === true);

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
        return options?.reactStrictMode ? <StrictMode>{wrapped}</StrictMode> : wrapped;
    };

    await update(wrap(element), root);
    resolved.window?.present();

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
        },
        debug: (element: Container | Container[] = baseElement, debugOptions?: PrettyWidgetOptions) => {
            logWidget(element, debugOptions);
        },
        logRoles: () => {
            logRoles(baseElement);
        },
        screenshot: (selector?: WindowSelector, screenshotOptions?: ScreenshotOptions) =>
            captureAndSaveScreenshot(selector, screenshotOptions),
    };

    setScreen(result);

    return result;
};

export const cleanup = async (): Promise<void> => {
    await runCleanup();
};
