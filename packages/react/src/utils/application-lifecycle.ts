import { type ApplicationRunner, quitApplication, runApplication } from "@gtkx/ffi";

export type ApplicationLifecycle = {
    run(application: ApplicationRunner): void;
    quit(application: ApplicationRunner): void;
};

export type ApplicationLifecycleModule = {
    setApplicationLifecycle(next: Partial<ApplicationLifecycle> | null): void;
    defaultApplicationLifecycle: ApplicationLifecycle;
};

export const defaultApplicationLifecycle: ApplicationLifecycle = {
    run: (application) => runApplication(application),
    quit: (application) => quitApplication(application),
};

let lifecycle: ApplicationLifecycle = defaultApplicationLifecycle;

export const setApplicationLifecycle = (next: Partial<ApplicationLifecycle> | null): void => {
    lifecycle = { ...defaultApplicationLifecycle, ...next };
};

export const runApplicationLifecycle = (application: ApplicationRunner): void => {
    lifecycle.run(application);
};

export const quitApplicationLifecycle = (application: ApplicationRunner): void => {
    lifecycle.quit(application);
};
