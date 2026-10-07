import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import { registerClass } from "@gtkx/runtime";
import { describe, expect, expectTypeOf, it } from "vitest";
import { applicationProps } from "./helpers/application.js";
import { createTypeNameFactory } from "./helpers/unique-name.js";

const uniqueName = createTypeNameFactory("GtkxDefaultApplication");

describe("generated application default operations", () => {
    it("claims the native default when an application overrides setDefault", async () => {
        class CustomApplication extends Gio.Application {
            override setDefault(): void {
                return;
            }
        }

        registerClass(CustomApplication, { typeName: uniqueName("CustomSetter") });
        const previous = Gio.Application.getDefault();
        const application = new CustomApplication(applicationProps());
        expectTypeOf(application).toEqualTypeOf<CustomApplication>();
        application.on("activate", () => {});
        const completion = application.runAsync(["probe"]);

        try {
            expect(application.getIsRegistered()).toBe(true);
            expect(application.getIsRemote()).toBe(false);
            expect(Gio.Application.getDefault()).toBe(application);
            application.quit();
            await expect(completion).resolves.toBe(0);
            expect(Gio.Application.getDefault()).toBeNull();
        } finally {
            application.quit();
            await completion;
            Gio.Application.prototype.setDefault.call(previous);
        }
    });

    it("clears the process-wide default through a nullable method receiver", () => {
        const previous = Gio.Application.getDefault();
        const application = new Gio.Application(applicationProps());

        try {
            application.setDefault();
            expect(Gio.Application.getDefault()).toBe(application);
            Gio.Application.prototype.setDefault.call(null);
            expect(Gio.Application.getDefault()).toBeNull();
        } finally {
            if (previous === null) {
                Gio.Application.prototype.setDefault.call(null);
            } else {
                previous.setDefault();
            }
        }

        expectTypeOf<ThisParameterType<Gio.Application["setDefault"]>>().toEqualTypeOf<Gio.Application | null>();
    });

    it("preserves another application's default when creating and quitting an application", () => {
        const previous = Gio.Application.getDefault();
        const owner = new Gio.Application(applicationProps());

        try {
            owner.setDefault();
            const application = new Gio.Application();
            expectTypeOf(application).toEqualTypeOf<Gio.Application>();
            expect(Gio.Application.getDefault()).toBe(owner);
            application.quit();
            expect(Gio.Application.getDefault()).toBe(owner);
        } finally {
            if (previous === null) {
                Gio.Application.prototype.setDefault.call(null);
            } else {
                previous.setDefault();
            }
        }
    });

    it("preserves a custom application's required constructor options", async () => {
        let constructions = 0;

        interface CustomApplicationOptions extends Gio.ApplicationConstructorProps {
            sessionName: string;
        }

        class CustomApplication extends Gio.Application {
            readonly sessionName: string;

            constructor({ sessionName, ...props }: CustomApplicationOptions) {
                super(props);
                constructions += 1;
                this.sessionName = sessionName;
            }
        }

        registerClass(CustomApplication, { typeName: uniqueName("CustomConstructor") });
        const props = applicationProps();
        const application = new CustomApplication({ ...props, sessionName: "session-one" });
        expectTypeOf(application).toEqualTypeOf<CustomApplication>();

        expect(application).toBeInstanceOf(CustomApplication);
        expect(constructions).toBe(1);
        expect(application.sessionName).toBe("session-one");
        expect(application.getApplicationId()).toBe(props.applicationId);
        expect(application.getFlags()).toBe(props.flags);
        expect(application.getIsRegistered()).toBe(false);
        application.on("activate", (): void => undefined);

        await expect(application.runAsync(["probe"])).resolves.toBe(0);

        expect(application.getIsRegistered()).toBe(false);
        expect(constructions).toBe(1);
    });
});

describe("generated nullable method receivers", () => {
    it("passes null to an object receiver without creating a wrapper", () => {
        expect(Gio.Cancellable.prototype.isCancelled.call(null)).toBe(false);
        expectTypeOf<ThisParameterType<Gio.Cancellable["isCancelled"]>>().toEqualTypeOf<Gio.Cancellable | null>();
    });

    it("passes null to a boxed receiver alongside its explicit arguments", () => {
        expect(GLib.Error.prototype.matches.call(null, 0, 0)).toBe(false);
        expectTypeOf<ThisParameterType<GLib.Error["matches"]>>().toEqualTypeOf<GLib.Error | null>();
    });
});
