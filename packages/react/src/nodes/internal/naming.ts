/**
 * Converts a camelCase or PascalCase identifier to snake_case.
 *
 * Used at the boundary between the React reconciler (which keeps JSX-style
 * camelCase prop names) and the FFI construction metadata registry (whose
 * keys match the snake_case `ConstructorProperties` shape published by the
 * ts-for-gir-generated `.d.ts` contract).
 *
 * Examples: `"canShrink"` → `"can_shrink"`, `"iconName"` → `"icon_name"`,
 * `"label"` → `"label"` (unchanged for already-snake/lowercase identifiers).
 */
export function camelToSnake(name: string): string {
    return name.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
}

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
