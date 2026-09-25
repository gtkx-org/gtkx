import type { Component, ErrorInfo, ReactNode, ReactPortal } from "react";
import * as Gdk from "@gtkx/gi/gdk";
import { createLogger, type Logger } from "@gtkx/utils";
import { ConcurrentRoot } from "react-reconciler/constants.js";
import { injectIntoDevTools } from "./devtools.js";
import { type Container, reconciler } from "./host-config.js";
import { rootElement } from "./root-element.js";

type OpaqueRoot = { [opaqueRoot]: true };

/** Error info handed to a caught-error callback, naming the error boundary that stopped the error. */
type CaughtErrorInfo = ErrorInfo & {
    /** The error boundary that caught the error, or `null` when that boundary is not a class component. */
    errorBoundary?: Component<unknown> | null | undefined;
};

/** Options for {@link createRoot}, mirroring the options React DOM's own `createRoot` takes. */
type RootOptions = {
    /** Called for a render error no error boundary caught; the error is rethrown when this is omitted. */
    onUncaughtError?: ((error: unknown, errorInfo: ErrorInfo) => void) | undefined;
    /** Called for a render error an error boundary caught; the error is logged when this is omitted. */
    onCaughtError?: ((error: unknown, errorInfo: CaughtErrorInfo) => void) | undefined;
    /** Called for a render error React recovered from by rendering again; the error is logged when this is omitted. */
    onRecoverableError?: ((error: unknown, errorInfo: ErrorInfo) => void) | undefined;
    /** Prefix `useId` puts in front of every identifier it generates under this root. */
    identifierPrefix?: string | undefined;
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

const logRecoverableRenderError = (error: unknown): void => {
    log.error("recoverable render error", error);
};

const openContainer = (containerInfo: Container, options: RootOptions): OpaqueRoot => {
    injectIntoDevTools(reconciler);

    return reconciler.createContainer(
        containerInfo,
        ConcurrentRoot,
        null,
        false,
        null,
        options.identifierPrefix ?? "",
        options.onUncaughtError ?? rethrowUncaughtRenderError,
        options.onCaughtError ?? logCaughtRenderError,
        options.onRecoverableError ?? logRecoverableRenderError,
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

/**
 * Creates a render root for a GTKX application. Uncaught render errors are rethrown, errors caught by an
 * error boundary are logged, and errors React recovered from by rendering again are logged.
 *
 * @param container The GObject to render into; defaults to the shared {@link rootElement}, which holds no object.
 * @param options Error callbacks and the `useId` prefix; each callback left out falls back to the behavior above.
 */
const createRoot = (container: Container = rootElement, options: RootOptions = {}): Root => {
    const opaque = openContainer(container, options);

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
const createPortal = (children: ReactNode, container: Container, key?: string): ReactPortal =>
    reconciler.createPortal(children, container, null, key ?? null);

export {
    createRoot,
    quit,
    createPortal,
    type CaughtErrorInfo,
    type Root,
    type RootOptions,
};
