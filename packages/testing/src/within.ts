import type * as Gtk from "@gtkx/ffi/gtk";
import * as queries from "./queries.js";
import type { BoundQueries, ByRoleOptions, TextMatch, TextMatchOptions } from "./types.js";

export const within = (container: Gtk.Widget): BoundQueries => ({
    findByRole: (role, options?: ByRoleOptions) => queries.findByRole(container, role, options),
    findByLabelText: (text: TextMatch, options?: TextMatchOptions) => queries.findByLabelText(container, text, options),
    findByText: (text: TextMatch, options?: TextMatchOptions) => queries.findByText(container, text, options),
    findByTestId: (testId: TextMatch, options?: TextMatchOptions) => queries.findByTestId(container, testId, options),

    findAllByRole: (role, options?: ByRoleOptions) => queries.findAllByRole(container, role, options),
    findAllByLabelText: (text: TextMatch, options?: TextMatchOptions) =>
        queries.findAllByLabelText(container, text, options),
    findAllByText: (text: TextMatch, options?: TextMatchOptions) => queries.findAllByText(container, text, options),
    findAllByTestId: (testId: TextMatch, options?: TextMatchOptions) =>
        queries.findAllByTestId(container, testId, options),
});
