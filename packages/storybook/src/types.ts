import type * as Gtk from "@gtkx/gi/gtk";
import type { ComponentType, ReactNode } from "react";
import type {
    ComponentAnnotations,
    GlobalTypes,
    Renderer,
    ArgTypes as StorybookArgTypes,
    StoryContext as StorybookContext,
} from "storybook/internal/types";

type Args = Record<string, unknown>;

type NativeRenderer<TArgs extends object = Args> = Renderer & {
    component: ComponentType<TArgs>;
    storyResult: ReactNode;
    canvasElement: Gtk.Widget;
};

type ArgTypes<TArgs extends object = Args> = Partial<StorybookArgTypes<TArgs>>;

type StoryContext<TArgs extends object = Args> = Pick<
    StorybookContext<NativeRenderer<TArgs>, TArgs>,
    "id" | "name" | "title" | "args" | "initialArgs" | "argTypes" | "viewMode"
> & {
    parameters: Args;
    globals: Args;
};

type StoryRender<TArgs extends object = Args> = (args: TArgs, context: StoryContext<TArgs>) => ReactNode;

type StoryContextUpdate<TArgs extends object = Args> = {
    args?: Partial<TArgs>;
    globals?: Args;
};

type Decorator<TArgs extends object = Args> = (
    Story: (update?: StoryContextUpdate<TArgs>) => ReactNode,
    context: StoryContext<TArgs>,
) => ReactNode;

type Annotations<TArgs extends object> = {
    args?: Partial<TArgs>;
    argTypes?: ArgTypes<TArgs>;
    parameters?: Args;
    decorators?: Decorator<TArgs>[];
    render?: StoryRender<TArgs>;
    tags?: string[];
};

type ComponentMeta<TArgs extends object> = Annotations<TArgs> & Pick<
    ComponentAnnotations<NativeRenderer<TArgs>, TArgs>,
    "title" | "id" | "includeStories" | "excludeStories"
> & {
    component?: ComponentType<TArgs>;
    globals?: Args;
};

type ComponentOrProps<T> = T extends ComponentType<infer Props extends object>
    ? Props
    : T extends object ? T : Args;

type Simplify<T> = { [Key in keyof T]: T[Key] };

type UnionToIntersection<T> = (
    T extends unknown ? (value: T) => void : never
) extends (value: infer Intersection) => void ? Intersection : never;

type DeclaredArgs<T> = {
    [Key in keyof T as string extends Key
        ? never
        : number extends Key ? never : symbol extends Key ? never : Key]: T[Key];
};

type RenderArgs<T> = T extends (args: infer Props extends object, context: never) => ReactNode ? Props : object;

type DecoratorArgs<T> = T extends readonly (infer Item)[]
    ? UnionToIntersection<Item extends Decorator<infer Props extends object> ? Props : object>
    : object;

type ArgsFrom<T> = T extends { component?: infer Component; render?: infer Render; decorators?: infer Decorators }
    ? Simplify<
        (NonNullable<Component> extends ComponentType<infer Props extends object> ? Props : object) &
        DeclaredArgs<RenderArgs<NonNullable<Render>> & DecoratorArgs<NonNullable<Decorators>>>
    >
    : T extends { args: infer Defaults extends object } ? Defaults : Args;

type Meta<T = Args> = ComponentMeta<ComponentOrProps<T>>;

type StoryAnnotations<TArgs extends object> = Annotations<TArgs> & {
    name?: string;
    globals?: Args;
};

type DefaultArgs<T> = T extends { args: infer Defaults } ? Defaults : Record<never, never>;

type RequiredStoryArgs<T, TArgs extends object> =
    Omit<TArgs, keyof DefaultArgs<T>> & Partial<Pick<TArgs, keyof TArgs & keyof DefaultArgs<T>>>;

type StoryObj<T = Args> = T extends { component?: unknown; render?: unknown; decorators?: unknown; args?: unknown }
    ? StoryAnnotations<ArgsFrom<T>> & (Record<never, never> extends RequiredStoryArgs<T, ArgsFrom<T>>
        ? { args?: RequiredStoryArgs<T, ArgsFrom<T>> }
        : { args: RequiredStoryArgs<T, ArgsFrom<T>> })
    : StoryAnnotations<ComponentOrProps<T>>;

type Preview = Annotations<Args> & {
    initialGlobals?: Args;
    globalTypes?: GlobalTypes;
};

type ComposedStory<TArgs extends object = Args> = ((args: Partial<TArgs>) => ReactNode) & {
    args: Partial<TArgs>;
    argTypes: ArgTypes<TArgs>;
    parameters: Args;
    globals: Args;
    id: string;
    storyName: string;
    tags: string[];
};

type StoryModule = { default: unknown };

type StoryKeys<TModule extends StoryModule> = {
    [Key in keyof TModule]: Key extends "default" | "__esModule" | "__namedExportsOrder"
        ? never
        : TModule[Key] extends StoryAnnotations<ArgsFrom<TModule["default"]>>
            ? Key
            : never;
}[keyof TModule] & string;

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
