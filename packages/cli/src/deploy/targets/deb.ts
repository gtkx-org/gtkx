import type { DeployTarget } from "../types.js";
import { TAR } from "../tools.js";
import { nfpmTarget } from "./nfpm-target.js";

const debTarget: DeployTarget = nfpmTarget("deb", [TAR]);

export { debTarget };
