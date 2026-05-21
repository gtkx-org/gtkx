/**
 * Whether to include testing setup in GTKX projects.
 */
export type TestingOption = "vitest" | "none";

/**
 * Validates a project directory name.
 *
 * Project names must contain only lowercase letters, numbers, and hyphens.
 *
 * @param name - Candidate project name.
 * @returns `true` when the name is valid.
 */
export const isValidProjectName = (name: string): boolean => /^[a-z0-9-]+$/.test(name);
