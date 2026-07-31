import type { ErrorInfo, ReactNode, ReactPortal } from "react";
import * as Gdk from "@gtkx/gi/gdk";
import { createLogger, type Logger } from "@gtkx/utils";
import { ConcurrentRoot } from "react-reconciler/constants.js";
import { type Container, reconciler } from "./host-config.js";
import { rootElement } from "./root-element.js";

type OpaqueRoot = { [opaqueRoot]: true };

type RootErrorCallbacks = {
    onUncaughtError?: (error: unknown, info: ErrorInfo) => void;
    onCaughtError?: (error: unknown, info: ErrorInfo) => void;
    onRecoverableError?: (error: unknown, info: ErrorInfo) => void;
};

type ReconcilerRootOptions = RootErrorCallbacks & { containerInfo: Container };

/** A root that mounts an element tree into an explicit container and reports render errors. */
type ReconcilerRoot = {
    update: (element: ReactNode) => void;
    unmount: (teardown: (root: ReconcilerRoot) => Promise<void>) => Promise<void>;
};

/** The object {@link createRoot} returns: it renders an element tree into a container and can tear it down. */
type Root = {
    render: (element: ReactNode) => void;
    unmount: () => void;
};

type ErrorHandler = (error: unknown) => void;
type ErrorHandlerSlot = { get: () => ErrorHandler | null; set: (handler: ErrorHandler) => ErrorHandler | null };

declare const opaqueRoot: unique symbol;
const log: Logger = createLogger("react");
const activeRoots: Set<OpaqueRoot> = new Set();
const errorHandlerSlot = createErrorHandlerSlot();

function createErrorHandlerSlot(): ErrorHandlerSlot {
    let current: ErrorHandler | null = null;

    return {
        get: () => current,
        set: (handler) => {
            const previous = current;
            current = handler;

            return previous;
        },
    };
}

/**
 * Installs a process-wide handler for errors thrown while rendering or applying an update.
 *
 * @param handler The handler to install.
 * @returns The previously installed handler, or null.
 */
const setReconcilerErrorHandler = (handler: ErrorHandler): ErrorHandler | null => errorHandlerSlot.set(handler);

const rethrowUncaughtRenderError = (error: unknown): never => {
    throw error;
};

const logCaughtRenderError = (error: unknown): void => {
    log.error("caught render error", error);
};

const openContainer = (containerInfo: Container, callbacks: RootErrorCallbacks): OpaqueRoot => {
    const container = reconciler.createContainer(
        containerInfo,
        ConcurrentRoot,
        null,
        false,
        null,
        "",
        (error, info) => {
            errorHandlerSlot.get()?.(error);
            callbacks.onUncaughtError?.(error, info);
        },
        (error, info) => {
            errorHandlerSlot.get()?.(error);
            callbacks.onCaughtError?.(error, info);
        },
        (error, info) => {
            callbacks.onRecoverableError?.(error, info);
        },
        (): void => undefined,
    ) as OpaqueRoot;

    activeRoots.add(container);

    return container;
};

const unmountContainer = (container: OpaqueRoot): void => {
    reconciler.updateContainer(null, container, null, null);
    activeRoots.delete(container);
};

/**
 * Creates a root that mounts an element tree into a container, routing render errors to the supplied callbacks.
 *
 * @param options The container to render into and the error callbacks to route failures to.
 * @returns A {@link ReconcilerRoot}.
 */
const createReconcilerRoot = (options: ReconcilerRootOptions): ReconcilerRoot => {
    const container = openContainer(options.containerInfo, options);

    const root: ReconcilerRoot = {
        update: (element) => {
            reconciler.updateContainer(element, container, null, null);
        },
        unmount: async (teardown) => {
            await teardown(root);
            activeRoots.delete(container);
        },
    };

    return root;
};

/**
 * Creates a render root for a GTKX application.
 *
 * @param container The top-level container to render into; defaults to the shared {@link rootElement}.
 * @returns A {@link Root} exposing render and unmount.
 */
const createRoot = (container: Container = rootElement): Root => {
    const opaque = openContainer(container, {
        onUncaughtError: rethrowUncaughtRenderError,
        onCaughtError: logCaughtRenderError,
    });

    return {
        render: (element) => {
            reconciler.updateContainer(element, opaque, null, null);
        },
        unmount: () => {
            unmountContainer(opaque);
        },
    };
};

/** Unmounts every active render root and stops the originating signal from propagating further. */
const quit = (): typeof Gdk.EVENT_STOP => {
    for (const container of activeRoots) {
        unmountContainer(container);
    }

    return Gdk.EVENT_STOP;
};

/**
 * Renders children into a container other than the surrounding tree.
 *
 * @param children The element tree to render.
 * @param container The GObject, application, or {@link rootElement} to render into.
 * @param key An optional stable key.
 * @returns A React portal.
 */
const createPortal = (children: ReactNode, container: Container, key?: string): ReactPortal =>
    reconciler.createPortal(children, container, null, key ?? null) as unknown as ReactPortal;

export {
    setReconcilerErrorHandler,
    createReconcilerRoot,
    createRoot,
    quit,
    createPortal,
    type ReconcilerRoot,
    type Root,
};
