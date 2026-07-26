import { quit } from "./lifecycle.js";

process.on("exit", quit);
