import type { DeployTarget } from "../types.js";
import { nfpmTarget } from "./nfpm-target.js";

const rpmTarget: DeployTarget = nfpmTarget("rpm");

export { rpmTarget };
