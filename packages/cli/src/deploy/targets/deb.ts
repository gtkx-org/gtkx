import type { DeployTarget } from "../types.js";
import { nfpmTarget } from "./nfpm-target.js";

const debTarget: DeployTarget = nfpmTarget("deb");

export { debTarget };
