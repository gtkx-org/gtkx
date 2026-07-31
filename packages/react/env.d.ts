declare module "virtual:gtkx-config" {
    export const signals: Record<string, Record<string, string>>;
    export const constructOnlyProps: Record<string, Set<string>>;
    export const constructProps: Record<string, Set<string>>;
    export const defaultProps: Record<string, Record<string, unknown>>;
    export const applicationId: import("@gtkx/config").ResolvedConfig["applicationId"];
    export const userEventSignals: import("@gtkx/config").ResolvedConfig["userEventSignals"];
    export const elements: Record<string, import("@gtkx/react/config").ElementConfig>;
}
