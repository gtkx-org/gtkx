/**
 * Reconciler-internal entry point for first-party gtkx packages (e.g. `@gtkx/testing`).
 *
 * These symbols drive the reconciler root, root-element container, and reconciler error sink.
 * They are not part of the app-author public API exported from the package root and may change
 * without a major-version bump; depend on them only from within the gtkx monorepo.
 *
 * @packageDocumentation
 */

export { type ReconcilerErrorHandler, setReconcilerErrorHandler } from "./reconciler/reconciler-error-sink.js";
export { createReconcilerRoot, type ReconcilerRoot, type ReconcilerRootOptions } from "./reconciler/reconciler-root.js";
export { isRootElement } from "./reconciler/root-element.js";
