import { z } from "zod";

const DEFAULT_CONFIG_FILE = "gtkx.config.*";

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const configPrefix = (configFile: string): string => `${configFile}:`;

const missingConfigFileError = (cwd: string, configFile?: string): Error =>
    new Error(configFile === undefined
        ? `${configPrefix(DEFAULT_CONFIG_FILE)} no configuration file found in ${cwd}`
        : `${configPrefix(configFile)} no configuration file found in ${cwd}`);

const configError = (error: z.ZodError, configFile = DEFAULT_CONFIG_FILE): Error =>
    new Error(`${configPrefix(configFile)}\n${z.prettifyError(error)}`);

export { isRecord, missingConfigFileError, configError };
