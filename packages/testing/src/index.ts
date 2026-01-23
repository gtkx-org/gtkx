export type { Config } from "./config.js";
export { configure, getConfig } from "./config.js";
export { fireEvent } from "./fire-event.js";
export type { PrettyWidgetOptions } from "./pretty-widget.js";
export { prettyWidget } from "./pretty-widget.js";
export {
    findAllByLabelText,
    findAllByRole,
    findAllByTestId,
    findAllByText,
    findByLabelText,
    findByRole,
    findByTestId,
    findByText,
    queryAllByLabelText,
    queryAllByRole,
    queryAllByTestId,
    queryAllByText,
    queryByLabelText,
    queryByRole,
    queryByTestId,
    queryByText,
} from "./queries.js";
export { cleanup, render } from "./render.js";
export { renderHook } from "./render-hook.js";
export type { RoleInfo } from "./role-helpers.js";
export { getRoles, logRoles, prettyRoles } from "./role-helpers.js";
export { screen } from "./screen.js";
export type { ScreenshotOptions } from "./screenshot.js";
export { screenshot } from "./screenshot.js";
export { tick } from "./timing.js";
export type {
    BoundQueries,
    ByRoleOptions,
    NormalizerOptions,
    RenderHookOptions,
    RenderHookResult,
    RenderOptions,
    RenderResult,
    ScreenshotResult,
    TextMatch,
    TextMatchFunction,
    TextMatchOptions,
    WaitForOptions,
} from "./types.js";
export type { PointerInput, TabOptions } from "./user-event.js";
export { userEvent } from "./user-event.js";
export { waitFor, waitForElementToBeRemoved } from "./wait-for.js";
export { within } from "./within.js";
