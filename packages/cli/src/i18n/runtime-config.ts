const I18N_RUNTIME_CONFIG_FILENAME = "gtkx-i18n.json";

const renderI18nRuntimeConfig = (localeDir: string): string => `${JSON.stringify({ localeDir })}\n`;

export { I18N_RUNTIME_CONFIG_FILENAME, renderI18nRuntimeConfig };
