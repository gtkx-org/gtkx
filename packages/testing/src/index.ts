import "./setup-runtime.js";

export { act } from "./act.js";
export { addToCleanupQueue, type CleanupFunction, runCleanup } from "./cleanup-registry.js";
export type { AsyncWrapper, Config, ConfigFn, EventWrapper } from "./config.js";
export { configure, getConfig } from "./config.js";
export { fireEvent } from "./fire-event.js";
export type { PrettyWidgetOptions } from "./pretty-widget.js";
export { logWidget, prettyWidget } from "./pretty-widget.js";
export {
    findAllByDisplayValue,
    findAllByLabelText,
    findAllByName,
    findAllByPlaceholderText,
    findAllByRole,
    findAllByText,
    findByDisplayValue,
    findByLabelText,
    findByName,
    findByPlaceholderText,
    findByRole,
    findByText,
    getAllByDisplayValue,
    getAllByLabelText,
    getAllByName,
    getAllByPlaceholderText,
    getAllByRole,
    getAllByText,
    getByDisplayValue,
    getByLabelText,
    getByName,
    getByPlaceholderText,
    getByRole,
    getByText,
    getDefaultNormalizer,
    queryAllByDisplayValue,
    queryAllByLabelText,
    queryAllByName,
    queryAllByPlaceholderText,
    queryAllByRole,
    queryAllByText,
    queryByDisplayValue,
    queryByLabelText,
    queryByName,
    queryByPlaceholderText,
    queryByRole,
    queryByText,
} from "./queries.js";
export { cleanup, render } from "./render.js";
export { renderHook } from "./render-hook.js";
export type { RoleInfo } from "./role-helpers.js";
export { formatRole, getRoles, logRoles, prettyRoles } from "./role-helpers.js";
export { screen } from "./screen.js";
export { captureAndSaveScreenshot, logScreenshotPath, screenshot } from "./screenshot.js";
export type { Method, Suggestion, Variant } from "./suggestions.js";
export { getSuggestedQuery } from "./suggestions.js";
export type { Container } from "./traversal.js";
export type {
    BoundQueries,
    ByRoleOptions,
    ByRoleValue,
    Matcher,
    MatcherFunction,
    MatcherOptions,
    NormalizerFn,
    NormalizerOptions,
    RenderHookOptions,
    RenderHookResult,
    RenderOptions,
    RenderResult,
    ScreenshotOptions,
    ScreenshotResult,
    WaitForOptions,
    WindowSelector,
    WrapperComponent,
} from "./types.js";
export type {
    DragOptions,
    DropContent,
    DropOptions,
    PointerInput,
    TabOptions,
    TypeOptions,
    UserEvent,
    UserEventInstance,
    UserEventOptions,
} from "./user-event.js";
export { userEvent } from "./user-event.js";
export { waitFor, waitForElementToBeRemoved } from "./wait-for.js";
export { getWidgetPropertyText } from "./widget-text.js";
export { within } from "./within.js";
