import { resolve } from "node:path";

const DEFAULT_DEPLOY_OUT_DIR = "build";

const deployOutDirFor = (root: string, configured: string | undefined): string =>
    resolve(root, configured ?? DEFAULT_DEPLOY_OUT_DIR);

export { DEFAULT_DEPLOY_OUT_DIR, deployOutDirFor };
