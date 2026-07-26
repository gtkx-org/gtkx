const isValidProjectName = (name: string): boolean => /^[a-z0-9-]+$/.test(name);

export { isValidProjectName };
