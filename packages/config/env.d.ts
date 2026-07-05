declare module "virtual:gtkx-config" {
    export const SIGNALS: Record<string, Record<string, string>>;
    export const CONSTRUCT_ONLY_PROPS: Record<string, Set<string>>;
    export const CONSTRUCT_PROPS: Record<string, Set<string>>;
    export const DEFAULT_PROPS: Record<string, Record<string, unknown>>;
    export const TOPLEVEL_TYPES: string[];
    export const DEFAULT_BLOCKABLE_TYPES: string[];
    export const RELATIONSHIPS: import("@gtkx/config").RelationshipRule[];
    export const SYNTHETIC_PROPS: import("@gtkx/config").SyntheticPropRule[];
    export const ACCESSIBLE_ATTRIBUTES: Record<
        string,
        {
            kind: "property" | "state" | "relation";
            member: string;
            value: "string" | "boolean" | "int" | "double" | "object" | "ref-list";
        }
    >;
    export const libraries: import("@gtkx/config").ResolvedGtkxConfig["libraries"];
    export const girPath: import("@gtkx/config").ResolvedGtkxConfig["girPath"];
    export const applicationId: import("@gtkx/config").ResolvedGtkxConfig["applicationId"];
    export const reactCompiler: import("@gtkx/config").ResolvedGtkxConfig["reactCompiler"];
}
