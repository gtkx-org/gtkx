import type { ErrorInfo, ReactNode, ReactPortal } from "react";
import * as Gdk from "@gtkx/gi/gdk";
import * as GObject from "@gtkx/gi/gobject";
import { createLogger, type Logger } from "@gtkx/utils";
import { ConcurrentRoot } from "react-reconciler/constants.js";
import { reportReconcilerError } from "./commit-errors.js";
import { injectIntoDevTools } from "./devtools.js";
import { type ContainerTarget, createHostContainer, getPortalContainer, reconciler } from "./host-config.js";
import { rootElement, type RootElement } from "./root-element.js";

type OpaqueRoot = { [opaqueRoot]: true };

type RootErrorCallbacks = {
    onUncaughtError?: (error: unknown, info: ErrorInfo) => void;
    onCaughtError?: (error: unknown, info: ErrorInfo) => void;
    onRecoverableError?: (error: unknown, info: ErrorInfo) => void;
};

type ReconcilerRootOptions = RootErrorCallbacks & { containerInfo: ContainerTarget };

/** A render root whose updates and teardown the caller drives, with error handling left to it. */
type ReconcilerRoot = {
    /**
     * Mounts an element tree into the container, or updates the tree already mounted there. Passing `null` unmounts
     * the container instead.
     */
    update: (element: ReactNode) => void;
    /** Hands the root to `teardown`, then stops {@link quit} from unmounting the container. */
    unmount: (teardown: (root: ReconcilerRoot) => Promise<void>) => Promise<void>;
};

/** The object {@link createRoot} returns: it renders an element tree into a container and can tear it down. */
type Root = {
    /**
     * Mounts an element tree into the container, or updates the tree already mounted there. Rendering `null` unmounts
     * the container instead.
     */
    render: (element: ReactNode) => void;
    /** Unmounts the rendered tree and runs its effect cleanups. */
    unmount: () => void;
};

declare const opaqueRoot: unique symbol;
const log: Logger = createLogger("react");
const activeRoots: Set<OpaqueRoot> = new Set();

const rethrowUncaughtRenderError = (error: unknown): never => {
    throw error;
};

const logCaughtRenderError = (error: unknown): void => {
    log.error("caught render error", error);
};

const openContainer = (containerInfo: ContainerTarget, callbacks: RootErrorCallbacks): OpaqueRoot => {
    injectIntoDevTools(reconciler);

    const reportUncaught = (error: unknown, info: ErrorInfo): void => {
        reportReconcilerError(error);
        callbacks.onUncaughtError?.(error, info);
    };

    const hostContainer = createHostContainer(containerInfo, (error) => {
        reportUncaught(error, { componentStack: null });
    });

    return reconciler.createContainer(
        hostContainer,
        ConcurrentRoot,
        null,
        false,
        null,
        "",
        reportUncaught,
        (error, info) => {
            reportReconcilerError(error);
            callbacks.onCaughtError?.(error, info);
        },
        (error, info) => {
            callbacks.onRecoverableError?.(error, info);
        },
        (): void => undefined,
    ) as OpaqueRoot;
};

const unmountContainer = (container: OpaqueRoot): void => {
    reconciler.updateContainer(null, container, null, null);
    activeRoots.delete(container);
};

const mountContainer = (container: OpaqueRoot, element: ReactNode): void => {
    if (element === null) {
        unmountContainer(container);

        return;
    }

    activeRoots.add(container);
    reconciler.updateContainer(element, container, null, null);
};

const createReconcilerRoot = (options: ReconcilerRootOptions): ReconcilerRoot => {
    const container = openContainer(options.containerInfo, options);

    const root: ReconcilerRoot = {
        update: (element) => {
            mountContainer(container, element);
        },
        unmount: async (teardown) => {
            await teardown(root);
            activeRoots.delete(container);
        },
    };

    return root;
};

/**
 * Creates a render root for a GTKX application. Uncaught render errors are rethrown and errors caught by an
 * error boundary are logged.
 *
 * @param container The GObject to render into; defaults to the shared {@link rootElement}, which holds no object.
 */
const createRoot = (container: RootElement | GObject.Object = rootElement): Root => {
    const opaque = openContainer(container, {
        onUncaughtError: rethrowUncaughtRenderError,
        onCaughtError: logCaughtRenderError,
    });

    return {
        render: (element) => {
            mountContainer(opaque, element);
        },
        unmount: () => {
            unmountContainer(opaque);
        },
    };
};

/**
 * Unmounts every render root that currently holds a mounted tree.
 *
 * @returns `Gdk.EVENT_STOP` when at least one root came down, so a close-request handler keeps GTK4 from closing the
 * window itself, and `Gdk.EVENT_PROPAGATE` when there was nothing to unmount, so the default handler still runs.
 */
const quit = (): typeof Gdk.EVENT_PROPAGATE | typeof Gdk.EVENT_STOP => {
    const containers = [...activeRoots];

    for (const container of containers) {
        unmountContainer(container);
    }

    return containers.length > 0 ? Gdk.EVENT_STOP : Gdk.EVENT_PROPAGATE;
};

/**
 * Renders children into a container other than the surrounding tree.
 *
 * @param container The GObject to render into, or {@link rootElement} to render at the top level.
 */
const createPortal = (children: ReactNode, container: RootElement | GObject.Object, key?: string): ReactPortal =>
    reconciler.createPortal(children, getPortalContainer(container, reportReconcilerError), null, key ?? null);

export {
    createReconcilerRoot,
    createRoot,
    quit,
    createPortal,
    type ReconcilerRoot,
    type Root,
};
export { setReconcilerErrorHandler } from "./commit-errors.js";
