#!/usr/bin/env node --conditions=source

import { runHeadless } from "./_utils.js";
import { mkdirSync } from "fs";

function runCodspeed(mode: string, measuredTask: string): void {
    const profileFolder = process.env.CODSPEED_PROFILE_FOLDER ?? "/tmp/codspeed-profile";
    mkdirSync(profileFolder, { recursive: true });

    runHeadless("codspeed", ["run", "-m", mode, "--", "pnpm", "--filter", "@gtkx/e2e", "bench"], {
        env: { ...process.env, CODSPEED_PROFILE_FOLDER: profileFolder, PATH: `/opt/node22/bin:${process.env.PATH ?? ""}` },
    });
}

runCodspeed("walltime", "bench:ts:measured");
