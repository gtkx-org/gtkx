export const PASCAL_CASE_NAME_PATTERN: RegExp = /^[A-Z][A-Za-z0-9]*$/;

export const CAMEL_CASE_NAME_PATTERN: RegExp = /^[a-z][A-Za-z0-9]*$/;

export const validateArrayOf = (
    value: unknown,
    path: string,
    validateElement: (element: unknown, elementPath: string) => void,
    onNotArray: (path: string) => never,
): void => {
    if (!Array.isArray(value)) onNotArray(path);
    value.forEach((element, index) => {
        validateElement(element, `${path}[${index}]`);
    });
};
