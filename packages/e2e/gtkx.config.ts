import { defineConfig, mergeConfig } from "@gtkx/config";
import base from "../../gtkx.config.js";

export default mergeConfig(base, defineConfig({ applicationId: "org.gtkx.e2e" }));
