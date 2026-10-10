import { fileURLToPath } from "node:url";

const nativeTests: string = fileURLToPath(new URL(".", import.meta.url));
const nativeCoverage: string = fileURLToPath(new URL("../../../../build/native-tests/coverage", import.meta.url));

export { nativeCoverage, nativeTests };
