import "./register-test-hooks.js";

export { act } from "./act.js";
export type { BoundQueries, RenderResult, Screen } from "./bound-queries.js";
export type {
    BuiltQueries,
    MissingErrorBuilder,
    MultipleErrorBuilder,
    QueryAllBy,
} from "./build-queries.js";
export { buildQueries } from "./build-queries.js";
export type { Config, ConfigFn } from "./config.js";
export { configure, getConfig } from "./config.js";
export { getElementError } from "./errors.js";
export type { WidgetEvent } from "./fire-event.js";
export { createEvent, fireEvent } from "./fire-event.js";
export type { ClassExpectation, TextContentOptions, TextExpectation } from "./matchers.js";
export { matchers, registerMatchers } from "./matchers.js";
export { getDefaultNormalizer } from "./normalize.js";
export { prettyFormat } from "./pretty-format.js";
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
export type { QueryHelpers } from "./query-helpers.js";
export { queryAllByObjectProperty, queryByObjectProperty, queryHelpers } from "./query-helpers.js";
export { renderHook } from "./render-hook.js";
export { cleanup, render } from "./render.js";
export { computeHeadingLevel, formatRole, getRoles, logRoles, prettyRoles } from "./role-helpers.js";
export { screen } from "./screen.js";
export { screenshot } from "./screenshot.js";
export type { Method, Suggestion, Variant } from "./suggestions.js";
export { getSuggestedQuery } from "./suggestions.js";
export type { Container } from "./traversal.js";
export type {
    ByRoleOptions,
    ByRoleValue,
    WidgetType,
    Matcher,
    MatcherFunction,
    MatcherOptions,
    NormalizerFn,
    NormalizerOptions,
    RenderHookOptions,
    RenderHookResult,
    RenderOptions,
    ScreenshotOptions,
    ScreenshotResult,
    WaitForOptions,
    WrapperComponent,
} from "./types.js";
export type { ControllerConstructor } from "./user-event/controller.js";
export {
    getAllControllers,
    getController,
    queryAllControllers,
    queryController,
} from "./user-event/controller.js";
export type {
    DragOffset,
    DragOptions,
    DropContent,
    DropOptions,
    PointerInput,
    ScrollDelta,
    TabOptions,
    TypeOptions,
    UserEvent,
    UserEventOptions,
} from "./user-event/index.js";
export { userEvent } from "./user-event/index.js";
export { waitFor, waitForElementToBeRemoved } from "./wait-for.js";
export { getWidgetText, isInaccessible } from "./widget-accessible-properties.js";
export { getQueriesForElement, within } from "./within.js";
