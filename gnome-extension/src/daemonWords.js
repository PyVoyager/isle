// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 zickrian

// isled's words in the user's language. isled (crates/isle-daemon) writes what the island shows in English,
// as its D-Bus API does; each text the island may show from it is listed here as isled writes it, its blanks
// as {names}, and shows translated. Anything else (an AI's own words, a newer isled's) shows as it came.
// tests/extension/daemonWords.test.js checks that each one is still in isled's code.

import {_, N_, NN_, ngettext} from './i18n.js';

/** isled's texts, the most particular first: "Searching the web for …" before "Searching {place} for …". A
 * pair is a text with a number, as ngettext takes it, matched by its second form ("30 days"). */
const WORDS = [
    // The assistant's steps (assistant/agent.rs `describe`, and each AI's own: claude.rs, codex.rs…).
    N_('Searching the web for “{query}”…'),
    N_('Searching the web…'),
    N_('Searching your files for “{term}”…'),
    N_('Searching your files…'),
    N_('Searching {place} for “{term}”…'),
    N_('Searching {place}…'),
    N_('Looking in your home folder…'),
    N_('Looking in {folder}…'),
    N_('Looking at your recent files…'),
    N_('Looking for an app for “{term}”…'),
    N_('Looking through your apps…'),
    N_('Looking at Chrome’s profiles…'),
    N_('Checking what’s using the computer…'),
    N_('Checking the network…'),
    N_('Checking what’s installed…'),
    N_('Checking this computer…'),
    N_('Reading the system log…'),
    N_('Reading a page…'),
    N_('Reading {name}…'),
    N_('Run a command'),
    // How a command the assistant ran ended, told once it does (assistant/mod.rs); {why} is the AI's own words.
    N_('{why}: done.'),
    N_('{why} didn’t finish. Click to see why.'),
    N_('{why} didn’t finish. {last}'),
    N_('{why} was interrupted before it finished. Ask me to check and finish it.'),
    // What went wrong, and what to do (assistant/brain.rs `explain`, assistant/mod.rs); {name} is the AI's app.
    N_('{name} needs Node.js'),
    N_('Reinstall it with its own installer, then ask again.'),
    N_('{name} isn’t installed'),
    N_('Install it, or pick another in Settings.'),
    N_('Update {name}'),
    N_('This version is too old for Isle; update it, then ask again.'),
    N_('{name} can’t use that model'),
    N_('Pick another model in Settings → Assistant.'),
    N_('Ask again: it answers with its own default model now, or pick another in Settings.'),
    N_('Sign in to {name}'),
    N_('Sign in, then ask again.'),
    N_('{name} can’t write its own files'),
    N_('Reinstalling it with its own installer usually puts this right.'),
    N_('{name} isn’t available'),
    N_('Its limit may be used up for now; try again later, or pick another in Settings.'),
    N_('You’re offline'),
    N_('Check the internet connection and try again.'),
    N_('{name} could not answer this time; try again.'),
    N_('{name} took too long to start'),
    N_('Try again in a moment.'),
    N_('{name} took too long'),
    N_('Try again, or ask for less at once.'),
    N_('No AI is set up'),
    N_('Install Claude Code, Codex, Grok or Antigravity (agy) and sign in, then pick it in Settings.'),
    N_('Isle is still answering the last request'),
    N_('Voice isn’t set up'),
    N_('Set up downloads speech recognition, once.'),
    N_('Didn’t catch that'),
    N_('Press Super+I and speak again.'),
    N_('The microphone is muted'),
    N_('Unmute it, then press Super+I again.'),
    N_('Speech model not downloaded'),
    N_('Set up downloads the one chosen in Settings.'),
    N_('Speech recognition failed'),
    N_('Try again. If it keeps failing, Set up puts it right.'),
    N_('No microphone'),
    N_('Check that a microphone is connected and not muted.'),
    // The AI plans' limits (usage.rs): the windows, and why the numbers may be old.
    N_('5 hours'),
    N_('Week'),
    N_('Month'),
    N_('Day'),
    N_('Limit'),
    N_('On demand'),
    NN_('{count} day', '{count} days'),
    NN_('{count} hour', '{count} hours'),
    N_('Open Claude Code to refresh its sign-in'),
    N_('Sign in again with Claude Code'),
    N_('Could not reach Claude; showing the last numbers'),
    N_('Open Grok to refresh its sign-in'),
    N_('Sign in again with Grok'),
    N_('Could not reach Grok; showing the last numbers'),
    N_('Offline; showing the last numbers'),
    N_('Grok doesn’t share how much of this plan is used'),
    // Why an AI agent's alerts could not be turned on (agents/mod.rs `refusal`).
    N_('{name} already sends its alerts to another app.'),
    N_('{name}’s settings file has a mistake. Fix it, then turn this on again.'),
    N_('Isle couldn’t change {name}’s settings. Try again.'),
    // A Bluetooth device with no name of its own (system/bluetooth.rs).
    N_('Bluetooth device'),
];

/** Isle's own words for isled's hints when no shortcut is set (see `VoiceView.withShortcut`). */
const NO_SHORTCUT = [
    N_('Speak again.'),
    N_('Unmute it, then press the mic in the island again.'),
];

/** What a blank holds: {name} is one of the AIs isled names (brain.rs and agents/mod.rs `name`), {count} a
 * number; any other, at least a character, as few as fit. So "Update {name}" is never an AI's "Update the
 * system". */
const BLANKS = {name: '(Antigravity|Claude Code|Codex|Grok)', count: '(\\d+)'};

let known = null;

/** The texts by their words, and the patterns of those with blanks, in order. */
function learn() {
    const exact = new Map();
    const patterns = [];
    for (const entry of [...WORDS, ...NO_SHORTCUT]) {
        const template = Array.isArray(entry) ? entry[1] : entry;
        const names = [...template.matchAll(/\{(\w+)\}/g)].map(m => m[1]);
        if (!names.length) {
            exact.set(template, entry);
            continue;
        }
        const parts = template.split(/\{\w+\}/).map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const source = parts.map((part, i) => i === 0 ? part : (BLANKS[names[i - 1]] ?? '(.+?)') + part).join('');
        patterns.push({pattern: new RegExp(`^${source}$`, 'u'), names, entry});
    }
    return {exact, patterns};
}

/** `text` from isled in the user's language, if it is one of isled's own; else as it came. */
export function words(text) {
    if (!text)
        return text ?? '';
    known ??= learn();
    const exact = known.exact.get(text);
    if (exact)
        return Array.isArray(exact) ? ngettext(exact[0], exact[1], 2) : _(exact);
    for (const {pattern, names, entry} of known.patterns) {
        const found = pattern.exec(text);
        if (!found)
            continue;
        const values = Object.fromEntries(names.map((name, i) => [name, found[i + 1]]));
        return Array.isArray(entry) ? ngettext(entry[0], entry[1], Number(values.count), values) : _(entry, values);
    }
    return text;
}

/** A limit window's name as isled gives it ("Week · Opus"): its span translated, a model's name as it is. */
export function windowName(label) {
    const [span, ...model] = (label ?? '').split(' · ');
    return [words(span), ...model].join(' · ');
}

/** Every text listed here, as isled writes it, for tests: [text, or [one, many]]. */
export const ALL = [...WORDS];
