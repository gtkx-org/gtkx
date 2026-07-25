declare module "virtual:gtkx-config" {
    export const SIGNALS: Record<string, Record<string, string>>;
    export const CONSTRUCT_ONLY_PROPS: Record<string, Set<string>>;
    export const CONSTRUCT_PROPS: Record<string, Set<string>>;
    export const DEFAULT_PROPS: Record<string, Record<string, unknown>>;
    export const applicationId: import("@gtkx/config").ResolvedConfig["applicationId"];
    export const userEventSignals: import("@gtkx/config").ResolvedConfig["userEventSignals"];
    export const elements: Record<string, import("@gtkx/react/config").ElementConfig>;
}
