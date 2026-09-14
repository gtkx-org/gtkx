import config from "../gtkx.config.js";
import { mergeConfig } from "../packages/config/src/index.js";

export default mergeConfig(config, { applicationId: config.applicationId, agents: { reference: false } });
