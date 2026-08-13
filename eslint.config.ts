import { config } from "@gtkx/eslint";
import api from "./api.json" with { type: "json" };

export default config(import.meta.dirname, api);
