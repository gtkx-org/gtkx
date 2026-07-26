import { defineConfig, mergeConfig } from "@gtkx/config";
import base from "../../gtkx.config.base.js";
export default mergeConfig(base, defineConfig({ applicationId: "org.gtkx.components" }));
