import "./bootstrap.js";
import { init as upstreamInit, t as upstreamT } from "i18next";
import {
    getI18n as upstreamGetI18n,
    IcuTrans as upstreamIcuTrans,
    IcuTransWithoutContext as upstreamIcuTransWithoutContext,
    Trans as upstreamTrans,
    Translation as upstreamTranslation,
    TransWithoutContext as upstreamTransWithoutContext,
    useTranslation as upstreamUseTranslation,
    withTranslation as upstreamWithTranslation,
} from "react-i18next";
import type {
    GetI18n,
    IcuTransComponent,
    IcuTransWithoutContextComponent,
    Init,
    TFunction,
    TransComponent,
    TranslationComponent,
    TransWithoutContextComponent,
    UseTranslation,
    WithTranslationFactory,
} from "./types.js";

/**
 * Translation metadata generated from an application's source messages.
 * Applications augment this interface to enable strict translation calls.
 */
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- declaration merging requires an interface
interface TranslationRegistry extends Record<never, never> {}

/** Translates a message through the configured i18next singleton. */
const t: TFunction = upstreamT;
/** Initializes the configured i18next singleton. */
const init: Init = upstreamInit;
/** Returns the configured i18next singleton. */
const getI18n: GetI18n = upstreamGetI18n;
/** Returns a translator and the configured i18next instance for React components. */
const useTranslation: UseTranslation = upstreamUseTranslation;
/** Injects the configured translator into a React component. */
const withTranslation: WithTranslationFactory = upstreamWithTranslation;
/** Supplies the configured translator through a React render prop. */
const Translation: TranslationComponent = upstreamTranslation;
/** Renders translated React content through the configured i18next singleton. */
const Trans: TransComponent = upstreamTrans;
/** Renders translated React content without an inherited gettext context. */
const TransWithoutContext: TransWithoutContextComponent = upstreamTransWithoutContext;
/** Renders ICU-formatted React content through the configured i18next singleton. */
const IcuTrans: IcuTransComponent = upstreamIcuTrans;
/** Renders ICU-formatted React content without an inherited gettext context. */
const IcuTransWithoutContext: IcuTransWithoutContextComponent = upstreamIcuTransWithoutContext;

export {
    IcuTrans,
    IcuTransWithoutContext,
    getI18n,
    init,
    Trans,
    TransWithoutContext,
    Translation,
    t,
    type TranslationRegistry,
    useTranslation,
    withTranslation,
};
export type {
    TFunction,
    TranslationProps,
    UseTranslationResponse,
    WithTranslation,
} from "./types.js";
export * from "react-i18next";
