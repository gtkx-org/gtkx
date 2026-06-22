declare module "virtual:gtkx-config" {
    export const SIGNALS: import("@gtkx/config").PerElementPropRows<string>;
    export const CONSTRUCT_ONLY_PROPS: Record<string, Set<string>>;
    export const CONSTRUCT_PROPS: Record<string, Set<string>>;
    export const DEFAULT_PROPS: import("@gtkx/config").PerElementPropRows<unknown>;
    export const ELEMENT_MAP: import("@gtkx/config").ElementMapRule[];
    export const ARRAY_PROPS: import("@gtkx/config").PerElementPropRows<import("@gtkx/config").ArrayPropRow>;
    export const OBJECT_PROPS: import("@gtkx/config").PerElementPropRows<import("@gtkx/config").ObjectPropRow>;
    export const VIRTUAL_PROPS: import("@gtkx/config").PerElementPropRows<import("@gtkx/config").VirtualPropRow>;
    export const PROP_RULES: Record<string, import("@gtkx/config").PropRule[]>;
    export const TOP_LEVEL_TYPES: string[];
    export const DEFAULT_BLOCKABLE_TYPES: string[];
    export const META_OBJECT_ADD_METHODS: Record<string, import("@gtkx/config").AddMethodRule[]>;
    export const PAGE_META_SETTERS: import("@gtkx/config").PageMetaSetter[];
    export const CONTAINER_PROPS: import("@gtkx/config").PerElementPropRows<import("@gtkx/config").ContainerPropRow>;
    export const ATTACH_SHAPES: import("@gtkx/config").AttachShapeTable;
    export const libraries: import("@gtkx/config").ResolvedGtkxConfig["libraries"];
    export const girPath: import("@gtkx/config").ResolvedGtkxConfig["girPath"];
    export const applicationId: import("@gtkx/config").ResolvedGtkxConfig["applicationId"];
    export const containerProps: import("@gtkx/config").ResolvedGtkxConfig["containerProps"];
    export const arrayProps: import("@gtkx/config").ResolvedGtkxConfig["arrayProps"];
    export const objectProps: import("@gtkx/config").ResolvedGtkxConfig["objectProps"];
    export const virtualProps: import("@gtkx/config").ResolvedGtkxConfig["virtualProps"];
    export const elementMap: import("@gtkx/config").ResolvedGtkxConfig["elementMap"];
    export const reactCompiler: import("@gtkx/config").ResolvedGtkxConfig["reactCompiler"];
}
