declare module "virtual:gtkx-config" {
    export const SIGNALS: Record<string, Record<string, string>>;
    export const CONSTRUCT_ONLY_PROPS: Record<string, Set<string>>;
    export const CONSTRUCT_PROPS: Record<string, Set<string>>;
    export const DEFAULT_PROPS: Record<string, Record<string, unknown>>;
    export const ELEMENT_PROPS: Record<string, import("@gtkx/config").ElementProp[]>;
    export const applicationId: import("@gtkx/config").ResolvedConfig["applicationId"];
}
