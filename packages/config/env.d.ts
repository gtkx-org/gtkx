declare module "virtual:gtkx-config" {
    export const SIGNALS: Record<string, Record<string, string>>;
    export const CONSTRUCT_ONLY_PROPS: Record<string, Set<string>>;
    export const CONSTRUCT_PROPS: Record<string, Set<string>>;
    export const DEFAULT_PROPS: Record<string, Record<string, unknown>>;
    export const TOPLEVEL_TYPES: string[];
    export const DEFAULT_BLOCKABLE_TYPES: string[];
    export const META_OBJECT_ADD_METHODS: Record<string, import("@gtkx/config").AddMethodRule[]>;
    export const PAGE_META_SETTERS: import("@gtkx/config").PageMetaSetter[];
    export const ATTACH_SHAPES: import("@gtkx/config").AttachShapeTable;
    export const ORDERED_INSERT: Record<string, import("@gtkx/config").OrderedInsertSpec>;
    export const SLOT_PROPS: Record<string, string[]>;
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
