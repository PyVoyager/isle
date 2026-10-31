// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 zickrian

// isled's words as the island translates them (src/daemonWords.js): each still written so in isled's code,
// and each found, blanks and all, in what isled sends.

import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

import {ALL, windowName, words} from '../../gnome-extension/src/daemonWords.js';
import {setTranslations} from '../../gnome-extension/src/i18n.js';

const crates = resolve(dirname(fileURLToPath(import.meta.url)), '../../crates');

/** Every Rust file under `dir`. */
function rustFiles(dir) {
    return readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
        const path = join(dir, entry.name);
        return entry.isDirectory() ? rustFiles(path) : entry.name.endsWith('.rs') ? [path] : [];
    });
}

const rust = rustFiles(crates).map(file => readFileSync(file, 'utf8')).join('\n');
/** `text` as a pattern: its words as written, each {blank} any of format!'s ("{}", "{name}", "{}"). */
const inRust = text => new RegExp(text.split(/\{\w+\}/).map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\{[^{}"]*\\}'), 'u');
/** Texts isled puts together from two of its own: the step's words, and the place or thing it names. */
const COMPOSED = {
    'Searching your files for “{term}”…': ['Searching {place} for “{term}”…', 'your files'],
    'Searching your files…': ['Searching {place}…', 'your files'],
    'Reading a page…': ['Reading {name}…', 'a page'],
};

test('each of isled\'s texts is still in its code as the island knows it', () => {
    const missing = ALL.map(entry => Array.isArray(entry) ? entry[1] : entry).filter(text => {
        const [whole, part] = COMPOSED[text] ?? [text, null];
        const found = /\{\w+\}/.test(whole) ? inRust(whole).test(rust) : rust.includes(`"${whole}"`);
        return !found || (part !== null && !rust.includes(`"${part}"`));
    });
    assert.deepEqual(missing, []);
});

test('without translations, isled\'s texts come back as they were', () => {
    setTranslations(null);
    for (const text of ['Searching Downloads for “ttd”…', 'Sign in to Claude Code', 'Week', 'an AI’s own words', ''])
        assert.equal(words(text), text);
});

test('a text is found with its blanks, the most particular first, and only isled\'s own', () => {
    // A translation that shows which text it was given, and puts the blanks its own way.
    const asked = [];
    setTranslations({
        gettext: text => (asked.push(text), `[${text}]`),
        ngettext: (one, many, count) => count === 1 ? `[${one}]` : `[${many}]`,
        pgettext: (_context, text) => text,
    });
    try {
        assert.equal(words('Searching Downloads for “ttd”…'), '[Searching Downloads for “ttd”…]');
        assert.equal(asked.at(-1), 'Searching {place} for “{term}”…');
        words('Searching the web for “weather”…');
        assert.equal(asked.at(-1), 'Searching the web for “{query}”…');
        words('Searching your files…');
        assert.equal(asked.at(-1), 'Searching your files…');
        words('Reading the system log…');
        assert.equal(asked.at(-1), 'Reading the system log…');
        assert.equal(words('Codex took too long to start'), '[Codex took too long to start]');
        assert.equal(asked.at(-1), '{name} took too long to start');
        assert.equal(words('30 days'), '[30 days]');
        assert.equal(words('1 days'), '[1 day]');
        assert.equal(windowName('Week · Opus'), '[Week] · Opus');
        // {name} is only an AI isled names: anything else that starts so is someone's own words.
        const before = asked.length;
        assert.equal(words('Update the system'), 'Update the system');
        assert.equal(words('Searching for nothing'), 'Searching for nothing');
        assert.equal(asked.length, before);
    } finally {
        setTranslations(null);
    }
});
