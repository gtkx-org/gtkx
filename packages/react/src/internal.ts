/**
 * Reconciler-internal entry point for first-party gtkx packages (e.g. `@gtkx/testing`).
 *
 * These symbols drive the reconciler root, root-element container, reconciler error sink, and
 * deferred-flush seam. They are not part of the app-author public API exported from the package
 * root and may change without a major-version bump; depend on them only from within the gtkx
 * monorepo.
 *
 * @packageDocumentation
 */

export { type DeferredFlushWrapper, setDeferredFlushWrapper } from "./reconciler/deferred-flush.js";
export { type ReconcilerErrorHandler, setReconcilerErrorHandler } from "./reconciler/reconciler-error-sink.js";
export { createReconcilerRoot, type ReconcilerRoot, type ReconcilerRootOptions } from "./reconciler/reconciler-root.js";
export { isRootElement } from "./reconciler/root-element.js";
