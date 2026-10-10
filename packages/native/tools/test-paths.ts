import { fileURLToPath } from "node:url";

const nativeTests: string = fileURLToPath(new URL("../../e2e/tests/native/", import.meta.url));
const nativeCoverage: string = fileURLToPath(new URL("../../../build/native-tests/coverage", import.meta.url));

export { nativeCoverage, nativeTests };
