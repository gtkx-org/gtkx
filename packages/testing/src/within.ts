import type * as Gtk from "@gtkx/ffi/gtk";
import { bindQueries } from "./bind-queries.js";
import type { BoundQueries } from "./types.js";

/**
 * Creates scoped query methods for a container widget.
 *
 * Use this to query within a specific section of your UI rather than
 * the entire application.
 *
 * @param container - The widget to scope queries to
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
export const within = (container: Gtk.Widget): BoundQueries => bindQueries(container);
