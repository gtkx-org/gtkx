import { bindQueries } from "./bind-queries.js";
import type { Container } from "./traversal.js";
import type { BoundCustomQueries, BoundQueries, QueryMap } from "./types.js";

/**
 * Creates scoped query methods for a container.
 *
 * Use this to query within a specific section of your UI rather than the entire
 * application. The container may be any query scope — a widget, a controller, or
 * the `TOPLEVELS` sentinel — and extra custom queries can be bound alongside the
 * built-ins.
 *
 * @param container - The scope to bind queries to
 * @param queries - Extra query functions to bind alongside the built-ins
 * @returns Object with query methods bound to the container
 *
 * @example
 * ```tsx
 * import { render, within } from "@gtkx/testing";
 *
 * test("scoped queries", async () => {
 *   await render(<MyPage />);
 *
 *   const sidebar = await screen.findByRole(Gtk.AccessibleRole.NAVIGATION);
 *   const sidebarQueries = within(sidebar);
 *
 *   // Only searches within the sidebar
 *   const navButton = await sidebarQueries.findByRole(Gtk.AccessibleRole.BUTTON);
 * });
 * ```
 *
 * @see {@link screen} for global queries
 */
export const within = <Q extends QueryMap = Record<never, never>>(
    container: Container,
    queries?: Q,
): BoundQueries & BoundCustomQueries<Q> => bindQueries(container, queries);
