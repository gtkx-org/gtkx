import { type GApplication, quitApplication, runApplication } from "@gtkx/ffi";

export type ApplicationLifecycle = {
    run(application: GApplication): void;
    quit(application: GApplication): void;
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

export const runApplicationLifecycle = (application: GApplication): void => {
    lifecycle.run(application);
};

export const quitApplicationLifecycle = (application: GApplication): void => {
    lifecycle.quit(application);
};
