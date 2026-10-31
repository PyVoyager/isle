// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 zickrian

// Isle's words in the user's language: gettext with Isle's own domain (po/ in the source,
// locale/ in the installed extension). Until the extension or Settings hands over its
// translations, and in tests, every text stays as written, in English.

let translations = null;

/** The extension (or Settings) whose gettext domain Isle's words come from; null lets go of it. */
export function setTranslations(extension) {
    translations = extension;
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
    return fill(translations && text ? translations.gettext(text) : text, values);
}

/** The form of a text for `count` things, with `{count}` (and any other `{names}`) filled in. */
export function ngettext(one, many, count, values) {
    const text = translations ? translations.ngettext(one, many, count) : count === 1 ? one : many;
    return fill(text, {count, ...values});
}

/** A text in the user's language that reads differently where `context` says: a "Clear" button or
 * a "Clear" sky. */
export function pgettext(context, text, values) {
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
