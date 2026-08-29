interface I18nResources extends Record<never, never> {}

declare module "i18next" {
    interface CustomTypeOptions {
        contextSeparator: "\u{4}";
        defaultNS: "translation";
        keySeparator: ".";
        nsSeparator: false;
        resources: I18nResources;
        strictKeyChecks: true;
    }
}

export { type I18nResources };
