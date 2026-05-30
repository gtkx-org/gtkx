/**
 * Converts a snake_case or kebab-case identifier to camelCase.
 *
 * Used by virtual slot nodes to translate a slot/page `id` prop into the
 * camelCase property name of the parent widget's child setter.
 *
 * Examples: `"icon-name"` → `"iconName"`, `"start_widget"` → `"startWidget"`,
 * `"label"` → `"label"` (unchanged for already-camel/lowercase identifiers).
 */
export function toCamelCase(name: string): string {
    return name.replaceAll(/[-_]([a-z])/g, (_, letter: string) => letter.toUpperCase());
}
