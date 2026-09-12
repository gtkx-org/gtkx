import type * as Gtk from "@gtkx/gi/gtk";
import type { ComponentType, ReactNode } from "react";
import type {
    ComponentAnnotations,
    GlobalTypes,
    Renderer,
    ArgTypes as StorybookArgTypes,
    StoryContext as StorybookContext,
} from "storybook/internal/types";

/** Named values supplied to a story, including component props and custom render args. */
type Args = Record<string, unknown>;

/** Storybook renderer types for React content rendered as native GTK widgets. */
type NativeRenderer<TArgs extends object = Args> = Renderer & {
    /** React component receiving the story's args. */
    component: ComponentType<TArgs>;
    /** React content returned by story rendering. */
    storyResult: ReactNode;
    /** Native widget type representing the preview canvas. */
    canvasElement: Gtk.Widget;
};

/** Explicit argument metadata used to configure native controls and named actions. */
type ArgTypes<TArgs extends object = Args> = Partial<StorybookArgTypes<TArgs>>;

/** Composed story identity, args, and annotations available to render functions and decorators. */
type StoryContext<TArgs extends object = Args> = Pick<
    StorybookContext<NativeRenderer<TArgs>, TArgs>,
    "id" | "name" | "title" | "args" | "initialArgs" | "argTypes" | "viewMode"
> & {
    /** Parameters merged from preview, component metadata, and the story. */
    parameters: Args;
    /** Global values after applying preview defaults and metadata or story overrides. */
    globals: Args;
};

/** Renders native React content from the current story args and composition context. */
type StoryRender<TArgs extends object = Args> = (args: TArgs, context: StoryContext<TArgs>) => ReactNode;

/** Values a decorator can override when invoking the decorated story. */
type StoryContextUpdate<TArgs extends object = Args> = {
    /** Partial args merged into the current invocation without changing composed defaults. */
    args?: Partial<TArgs>;
    /** Global values overridden for the decorated invocation. */
    globals?: Args;
};

/** Wraps story content and can override args or globals when invoking the supplied Story function. */
type Decorator<TArgs extends object = Args> = (
    Story: (update?: StoryContextUpdate<TArgs>) => ReactNode,
    context: StoryContext<TArgs>,
) => ReactNode;

/** Shared CSF annotations accepted at preview, component, and story scope. */
type Annotations<TArgs extends object> = {
    /** Default args, with more specific annotation scopes taking precedence. */
    args?: Partial<TArgs>;
    /** Explicit argument descriptions, controls, and action registrations. */
    argTypes?: ArgTypes<TArgs>;
    /** Parameters merged across scopes, including native preview and layout settings. */
    parameters?: Args;
    /** Wrappers composed around the story's render function. */
    decorators?: Decorator<TArgs>[];
    /** Custom renderer used in place of the component or a less specific render annotation. */
    render?: StoryRender<TArgs>;
    /** Storybook tags composed with tags from other annotation scopes. */
    tags?: string[];
};

/** Default export metadata describing a component's stories and their shared annotations. */
type ComponentMeta<TArgs extends object> = Annotations<TArgs> & Pick<
    ComponentAnnotations<NativeRenderer<TArgs>, TArgs>,
    "title" | "id" | "includeStories" | "excludeStories"
> & {
    /** Component rendered with story args when no custom render annotation applies. */
    component?: ComponentType<TArgs>;
    /** Global overrides shared by this component's stories. */
    globals?: Args;
};

/** Resolves a component's props or accepts an explicitly supplied args object type. */
type ComponentOrProps<T> = T extends ComponentType<infer Props extends object>
    ? Props
    : T extends object ? T : Args;

/** Presents combined inferred args as a single object type. */
type Simplify<T> = { [Key in keyof T]: T[Key] };

/** Combines the argument requirements of every member of a union. */
type UnionToIntersection<T> = (
    T extends unknown ? (value: T) => void : never
) extends (value: infer Intersection) => void ? Intersection : never;

/** Retains explicitly named args while removing broad index signatures. */
type DeclaredArgs<T> = {
    [Key in keyof T as string extends Key
        ? never
        : number extends Key ? never : symbol extends Key ? never : Key]: T[Key];
};

/** Extracts the args accepted by a custom render function. */
type RenderArgs<T> = T extends (args: infer Props extends object, context: never) => ReactNode ? Props : object;

/** Combines the args required by a metadata object's decorators. */
type DecoratorArgs<T> = T extends readonly (infer Item)[]
    ? UnionToIntersection<Item extends Decorator<infer Props extends object> ? Props : object>
    : object;

/** Infers story args from component props, render functions, decorators, or declared defaults. */
type ArgsFrom<T> = T extends { component?: infer Component; render?: infer Render; decorators?: infer Decorators }
    ? Simplify<
        (NonNullable<Component> extends ComponentType<infer Props extends object> ? Props : object) &
        DeclaredArgs<RenderArgs<NonNullable<Render>> & DecoratorArgs<NonNullable<Decorators>>>
    >
    : T extends { args: infer Defaults extends object } ? Defaults : Args;

/** CSF3 default export metadata typed from a React component or an explicit args type. */
type Meta<T = Args> = ComponentMeta<ComponentOrProps<T>>;

/** Annotations for one CSF3 story object, including its display name and global overrides. */
type StoryAnnotations<TArgs extends object> = Annotations<TArgs> & {
    /** Display name overriding the name derived from the story's named export. */
    name?: string;
    /** Global overrides applied specifically to this story. */
    globals?: Args;
};

/** Extracts args already defaulted by component metadata. */
type DefaultArgs<T> = T extends { args: infer Defaults } ? Defaults : Record<never, never>;

/** Makes args with metadata defaults optional while preserving other required args. */
type RequiredStoryArgs<T, TArgs extends object> =
    Omit<TArgs, keyof DefaultArgs<T>> & Partial<Pick<TArgs, keyof TArgs & keyof DefaultArgs<T>>>;

/** CSF3 story object inferred from metadata, a React component, or an explicit args type. */
type StoryObj<T = Args> = T extends { component?: unknown; render?: unknown; decorators?: unknown; args?: unknown }
    ? StoryAnnotations<ArgsFrom<T>> & (Record<never, never> extends RequiredStoryArgs<T, ArgsFrom<T>>
        ? { args?: RequiredStoryArgs<T, ArgsFrom<T>> }
        : { args: RequiredStoryArgs<T, ArgsFrom<T>> })
    : StoryAnnotations<ComponentOrProps<T>>;

/** Project annotations shared by all composed stories. */
type Preview = Annotations<Args> & {
    /** Initial global values available in story rendering and decorators. */
    initialGlobals?: Args;
    /** Storybook metadata describing global values; native toolbar controls are not provided. */
    globalTypes?: GlobalTypes;
};

/** Renderable story with merged annotations; props override its composed default args. */
type ComposedStory<TArgs extends object = Args> = ((args: Partial<TArgs>) => ReactNode) & {
    /** Default args merged across preview, component metadata, and story annotations. */
    args: Partial<TArgs>;
    /** Composed argument metadata available to native controls and actions. */
    argTypes: ArgTypes<TArgs>;
    /** Composed parameters available to the renderer and explorer. */
    parameters: Args;
    /** Composed global values available in story context. */
    globals: Args;
    /** Storybook identifier derived from component identity and the story export. */
    id: string;
    /** Story name attached by Storybook's portable composition API. */
    storyName: string;
    /** Tags resulting from composition across annotation scopes. */
    tags: string[];
};

/** Imported CSF module containing default metadata and named story exports. */
type StoryModule = {
    /** Component metadata validated when the module is composed. */
    default: unknown;
};

/** Named module exports whose types match CSF3 stories, excluding module bookkeeping. */
type StoryKeys<TModule extends StoryModule> = {
    [Key in keyof TModule]: Key extends "default" | "__esModule" | "__namedExportsOrder"
        ? never
        : TModule[Key] extends StoryAnnotations<ArgsFrom<TModule["default"]>>
            ? Key
            : never;
}[keyof TModule] & string;

/** Composed stories keyed by their original named exports. */
type ComposedStories<TModule extends StoryModule> = Record<
    StoryKeys<TModule>,
    ComposedStory<ArgsFrom<TModule["default"]>>
>;

export type {
    Args,
    ArgTypes,
    ComponentMeta,
    ComposedStories,
    ComposedStory,
    Decorator,
    Meta,
    Preview,
    StoryAnnotations,
    StoryContext,
    StoryContextUpdate,
    StoryModule,
    StoryObj,
    StoryRender,
};
