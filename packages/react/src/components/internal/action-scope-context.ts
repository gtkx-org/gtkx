import { createContext } from "react";

/**
 * The action-name scope a `<GSimpleAction>` binds its accelerators under: the
 * prefix of the action map it attaches to (`"app"` for an application,
 * `"win"` for an application window, a `<GSimpleActionGroup>`'s own `prefix`).
 */
export type ActionScope = {
    /** The action-name prefix (the part before the dot in `"win.close"`). */
    readonly prefix: string;
};

/** Stable scope provided by application components. */
export const APPLICATION_ACTION_SCOPE: ActionScope = { prefix: "app" };

/** Stable scope provided by application-window components. */
export const WINDOW_ACTION_SCOPE: ActionScope = { prefix: "win" };

/**
 * Shares the enclosing action scope with `<GSimpleAction>` descendants so
 * their `accels` bind under the right detailed action name — `null` outside
 * any action map.
 */
export const ActionScopeContext = createContext<ActionScope | null>(null);
