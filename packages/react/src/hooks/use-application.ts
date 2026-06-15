import type * as Gtk from "@gtkx/gi/gtk";
import { type Context, createContext, useContext } from "react";

/**
 * React Context providing access to the GTK Application instance.
 *
 * The {@link GtkApplication} and {@link AdwApplication} components publish their
 * backing application through this context. Use {@link useApplication} to read it
 * in descendant components.
 *
 * @example
 * ```tsx
 * const App = () => {
 *   const app = useApplication();
 *   console.log(app.applicationId);
 *   return <GtkLabel label="Hello" />;
 * };
 * ```
 */
export const ApplicationContext: Context<Gtk.Application | null> = createContext<Gtk.Application | null>(null);

/**
 * Hook to access the GTK Application instance.
 *
 * Must be called within a component rendered under a {@link GtkApplication} or
 * {@link AdwApplication}. Throws an error if called outside the application
 * context.
 *
 * @returns The GTK Application instance
 *
 * @example
 * ```tsx
 * const MyComponent = () => {
 *   const app = useApplication();
 *   return <GtkLabel label={app.applicationId} />;
 * };
 * ```
 *
 * @see {@link ApplicationContext} for the underlying context
 */
export const useApplication = (): Gtk.Application => {
    const context = useContext(ApplicationContext);

    if (!context) {
        throw new Error("Expected ApplicationContext: useApplication must be called within Application");
    }

    return context;
};
