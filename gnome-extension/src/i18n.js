// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 zickrian

// Isle's words in the user's language: gettext with Isle's own domain (po/ in the source,
// locale/ in the installed extension). Until the extension or Settings hands over its
// translations, and in tests, every text stays as written, in English.

const CATALOGS = new Map();
let translations = null;
let extensionPath = null;
let languageOverride = 'system';

/** Parses a GNU gettext .mo binary (little- or big-endian) into a Map of keys to NUL-split msgstr arrays. */
export function parseMo(bytes) {
    const map = new Map();
    if (!bytes || bytes.byteLength < 28)
        return map;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const magic = view.getUint32(0, true);
    const le = magic === 0x950412de ? true : magic === 0xde120495 ? false : null;
    if (le === null)
        return map;
    const count = view.getUint32(8, le);
    const origOffset = view.getUint32(12, le);
    const transOffset = view.getUint32(16, le);
    const decoder = new TextDecoder('utf-8');
    for (let i = 0; i < count; i++) {
        const oLen = view.getUint32(origOffset + i * 8, le);
        const oPos = view.getUint32(origOffset + i * 8 + 4, le);
        const tLen = view.getUint32(transOffset + i * 8, le);
        const tPos = view.getUint32(transOffset + i * 8 + 4, le);
        if (oPos + oLen > bytes.byteLength || tPos + tLen > bytes.byteLength)
            continue;
        const orig = decoder.decode(bytes.subarray(oPos, oPos + oLen));
        const trans = decoder.decode(bytes.subarray(tPos, tPos + tLen));
        // For plural entries, orig is "msgid\0msgid_plural"; the lookup key is the part before NUL.
        const key = orig.split('\u0000')[0];
        if (key)
            map.set(key, trans.split('\u0000'));
    }
    return map;
}

/** Plural form index (0, 1, 2) for Russian (and other Slavic 3-form languages). */
function pluralIndex(lang, n) {
    const abs = Math.abs(Math.trunc(n));
    if (lang === 'ru') {
        const mod10 = abs % 10;
        const mod100 = abs % 100;
        if (mod10 === 1 && mod100 !== 11)
            return 0;
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14))
            return 1;
        return 2;
    }
    return abs === 1 ? 0 : 1;
}

/** Loads and caches `<extensionPath>/locale/<lang>/LC_MESSAGES/isle.mo` via loadBytes when provided. */
function loadCatalog(lang) {
    if (CATALOGS.has(lang))
        return CATALOGS.get(lang);
    let catalog = null;
    if (extensionPath && typeof loadBytes === 'function') {
        try {
            const contents = loadBytes(`${extensionPath}/locale/${lang}/LC_MESSAGES/isle.mo`);
            if (contents)
                catalog = parseMo(contents);
        } catch {
            catalog = null;
        }
    }
    CATALOGS.set(lang, catalog);
    return catalog;
}

let loadBytes = null;

/** The extension (or Settings) whose gettext domain Isle's words come from; null lets go of it. */
export function setTranslations(extension, reader = null) {
    translations = extension;
    extensionPath = extension?.path ?? extension?.dir?.get_path?.() ?? null;
    loadBytes = reader;
    if (!extension) {
        languageOverride = 'system';
        CATALOGS.clear();
    }
}

/** Overrides the interface language ('system', 'ru', or 'en') regardless of the OS locale. */
export function setLanguage(lang) {
    languageOverride = lang || 'system';
}

/** `{name}` in a text replaced by `values.name`; a name without a value stays as it is. */
export function fill(text, values) {
    if (!values)
        return text;
    return text.replace(/\{(\w+)\}/g, (whole, name) => name in values ? String(values[name]) : whole);
}

/** A text in the user's language, with its `{names}` filled in from `values`. An empty text stays empty
 * (gettext would give the translation's header for it). */
export function _(text, values) {
    if (!text)
        return text;
    if (languageOverride === 'en')
        return fill(text, values);
    if (languageOverride && languageOverride !== 'system') {
        const catalog = loadCatalog(languageOverride);
        const found = catalog?.get(text)?.[0];
        if (found)
            return fill(found, values);
    }
    return fill(translations ? translations.gettext(text) : text, values);
}

/** The form of a text for `count` things, with `{count}` (and any other `{names}`) filled in. */
export function ngettext(one, many, count, values) {
    if (languageOverride === 'en')
        return fill(count === 1 ? one : many, {count, ...values});
    if (languageOverride && languageOverride !== 'system') {
        const catalog = loadCatalog(languageOverride);
        const forms = catalog?.get(one);
        if (forms?.length) {
            const chosen = forms[Math.min(pluralIndex(languageOverride, count), forms.length - 1)] || (count === 1 ? one : many);
            return fill(chosen, {count, ...values});
        }
    }
    const text = translations ? translations.ngettext(one, many, count) : count === 1 ? one : many;
    return fill(text, {count, ...values});
}

/** A text in the user's language that reads differently where `context` says: a "Clear" button or
 * a "Clear" sky. */
export function pgettext(context, text, values) {
    if (languageOverride === 'en')
        return fill(text, values);
    if (languageOverride && languageOverride !== 'system') {
        const catalog = loadCatalog(languageOverride);
        const found = catalog?.get(`${context}\u0004${text}`)?.[0];
        if (found)
            return fill(found, values);
    }
    return fill(translations && text ? translations.pgettext(context, text) : text, values);
}

/** Marks a text kept in a table to be translated where it shows (with `_`), as modules load before
 * the translations do. */
export function N_(text) {
    return text;
}

/** The same for a text with a number: its two English forms, translated where it shows with `ngettext`. */
export function NN_(one, many) {
    return [one, many];
}
