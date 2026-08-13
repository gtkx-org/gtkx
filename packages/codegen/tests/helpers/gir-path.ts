import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveGirPath } from "../../src/gir/gir-path.js";

const FIXTURE_GIR_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "gir");
const GIR_PATH = resolveGirPath(undefined);
const FIXTURE_GIR_PATH = [FIXTURE_GIR_DIR, ...GIR_PATH];

export { FIXTURE_GIR_DIR, FIXTURE_GIR_PATH, GIR_PATH };
