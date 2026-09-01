import { z } from "zod";

const CONFIG_PREFIX = "gtkx.config.ts:";

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const missingConfigFileError = (cwd: string): Error =>
    new Error(`${CONFIG_PREFIX} no configuration file found in ${cwd}`);

const configError = (error: z.ZodError): Error => new Error(`${CONFIG_PREFIX}\n${z.prettifyError(error)}`);

export { isRecord, missingConfigFileError, configError };
