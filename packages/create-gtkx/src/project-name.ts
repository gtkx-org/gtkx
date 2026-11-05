const PACKAGE_NAME_MAX_LENGTH = 214;
const PACKAGE_NAME_PATTERN = /^(?:@[a-z\d\-*~][a-z\d\-*._~]*\/)?[a-z\d\-~][a-z\d\-._~]*$/;

const withoutAccents = (name: string): string => name.normalize("NFKD").replaceAll(/\p{M}/gu, "");

const isValidPackageName = (name: string): boolean =>
    name.length <= PACKAGE_NAME_MAX_LENGTH && PACKAGE_NAME_PATTERN.test(name);

const toValidPackageName = (name: string): string =>
    withoutAccents(name)
        .toLowerCase()
        .replaceAll(/[^a-z0-9]+/g, "-")
        .replaceAll(/^-+|-+$/g, "")
        .slice(0, PACKAGE_NAME_MAX_LENGTH)
        .replace(/-+$/, "");

const packageNameFromDirectory = (directoryName: string): string =>
    isValidPackageName(directoryName) ? directoryName : toValidPackageName(directoryName);

export { isValidPackageName, packageNameFromDirectory, withoutAccents };
