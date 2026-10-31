// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 zickrian

// Isle's words in other languages: src/i18n.js as the extension uses it, and each po/ file whole and with
// the same blanks as the English (scripts/translations.sh checks they compile and match the template).

import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

import {_, fill, ngettext, pgettext, setTranslations} from '../../gnome-extension/src/i18n.js';

const po = resolve(dirname(fileURLToPath(import.meta.url)), '../../po');
/** How many plural forms each language has, as its Plural-Forms header must say. */
const PLURALS = {ru: 3};

/** A .po file's entries: {context, id, plural, strings: [msgstr or msgstr[n]...], fuzzy}, the header first. */
function entries(text) {
    const found = [];
    for (const block of text.split(/\n{2,}/)) {
        const entry = {context: null, id: null, plural: null, strings: [], fuzzy: false};
        let field = null;
        for (const line of block.split('\n')) {
            if (line.startsWith('#,'))
                entry.fuzzy ||= line.includes('fuzzy');
            const start = /^(msgctxt|msgid_plural|msgid|msgstr(?:\[\d+\])?) (".*")$/.exec(line);
            const more = /^(".*")$/.exec(line);
            if (start) {
                field = start[1];
                set(entry, field, JSON.parse(start[2]));
            } else if (more && field) {
                set(entry, field, JSON.parse(more[1]), true);
            }
        }
        if (entry.id !== null)
            found.push(entry);
    }
    return found;
}

/** Sets (or, `add`, continues) one field of an entry. */
function set(entry, field, value, add = false) {
    const key = {msgctxt: 'context', msgid: 'id', msgid_plural: 'plural'}[field];
    if (key) {
        entry[key] = add ? entry[key] + value : value;
        return;
    }
    const index = Number(/\[(\d+)\]/.exec(field)?.[1] ?? 0);
    entry.strings[index] = add ? entry.strings[index] + value : value;
}

/** The {names} in a text, sorted. */
const blanks = text => [...text.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();

test('without translations, texts stay in English with their blanks filled in', () => {
    setTranslations(null);
    assert.equal(_('Opening {app}…', {app: 'Files'}), 'Opening Files…');
    assert.equal(_('{name} is done', {}), '{name} is done');
    assert.equal(ngettext('{count} new notification', '{count} new notifications', 1), '1 new notification');
    assert.equal(ngettext('{count} new notification', '{count} new notifications', 3), '3 new notifications');
    assert.equal(pgettext('glass', 'Clear'), 'Clear');
    assert.equal(fill('{a} and {b}', {a: 1}), '1 and {b}');
});

test('with translations, the domain is asked, and an empty text never is', () => {
    const asked = [];
    setTranslations({
        gettext: text => (asked.push(text), `«${text}»`),
        ngettext: (one, many, count) => count === 1 ? `«${one}»` : `«${many}»`,
        pgettext: (context, text) => `«${context}|${text}»`,
    });
    try {
        assert.equal(_('Opening {app}…', {app: 'Files'}), '«Opening Files…»');
        assert.equal(_(''), '');
        assert.deepEqual(asked, ['Opening {app}…']);
        assert.equal(ngettext('{count} file', '{count} files', 2), '«2 files»');
        assert.equal(pgettext('glass', 'Clear'), '«glass|Clear»');
    } finally {
        setTranslations(null);
    }
});

for (const file of readdirSync(po).filter(name => name.endsWith('.po'))) {
    const language = file.replace(/\.po$/, '');
    const [header, ...messages] = entries(readFileSync(resolve(po, file), 'utf8'));

    test(`${file}: every text translated, none left fuzzy`, () => {
        assert.equal(header.id, '');
        assert.deepEqual(messages.filter(m => m.fuzzy || m.strings.some(s => !s)).map(m => m.id), []);
    });

    test(`${file}: each translation has the English text's blanks, no more, no fewer`, () => {
        const wrong = messages.filter(m => m.strings.some(s => blanks(s).join() !== blanks(m.plural ?? m.id).join() &&
            blanks(s).join() !== blanks(m.id).join()));
        assert.deepEqual(wrong.map(m => m.id), []);
    });

    test(`${file}: as many plural forms as the language has`, () => {
        const forms = Number(/nplurals=(\d+)/.exec(header.strings[0])?.[1]);
        if (PLURALS[language])
            assert.equal(forms, PLURALS[language]);
        assert.deepEqual(messages.filter(m => m.plural && m.strings.length !== forms).map(m => m.id), []);
    });
}
