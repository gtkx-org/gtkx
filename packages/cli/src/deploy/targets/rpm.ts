import type { DeployTarget } from "../types.js";
import { TAR } from "../tools.js";
import { nfpmTarget } from "./nfpm-target.js";

const rpmTarget: DeployTarget = nfpmTarget("rpm", [TAR]);

export { rpmTarget };
