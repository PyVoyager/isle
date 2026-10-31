#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 zickrian
# Isle's translations (po/, gettext domain "isle"); needs gettext (msgfmt, and xgettext and msgmerge to update).
#   update        the template (po/isle.pot) from the extension's words, and each language merged with it
#   check         the template matches the words, and each language compiles cleanly (CI runs this)
#   compile DIR   each language into DIR/locale/<lang>/LC_MESSAGES/isle.mo (DIR: an extension folder)
set -euo pipefail

cd "$(dirname "$0")/.."
DOMAIN=isle
POT="po/$DOMAIN.pot"

fail() { echo "translations: $*" >&2; exit 1; }

# The template, written to $1: every text the extension marks with _(), N_(), ngettext() or pgettext(). Their
# blanks are {names} (src/i18n.js), never printf's: "40% darker" is no format, nor a picture name's %Y.
template() {
    local sources=() plain=()
    mapfile -t sources < <(find gnome-extension -name '*.js' -not -path '*/node_modules/*' | LC_ALL=C sort)
    for spec in _:1 N_:1 ngettext:1 ngettext:2 pgettext:2; do
        plain+=("--flag=$spec:no-javascript-format")
    done
    xgettext --from-code=UTF-8 --language=JavaScript --keyword=_ --keyword=N_ --keyword=ngettext:1,2 \
        --keyword=pgettext:1c,2 "${plain[@]}" --add-comments=TRANSLATORS: --sort-by-file --package-name=Isle \
        --msgid-bugs-address=https://github.com/zickrian/isle/issues -o "$1" "${sources[@]}"
}

# A template's entries without its header and source lines, to compare two templates.
entries() {
    msgcat --no-location --no-wrap --sort-output "$1" | sed '1,/^$/d'
}

case "${1:-}" in
update)
    template "$POT"
    for po in po/*.po; do
        [ -e "$po" ] || continue
        msgmerge --quiet --update --backup=none --no-fuzzy-matching "$po" "$POT"
    done
    ;;
check)
    fresh="$(mktemp)"
    trap 'rm -f "$fresh"' EXIT
    template "$fresh"
    diff -u <(entries "$POT") <(entries "$fresh") >/dev/null ||
        fail "$POT is out of date with the extension's words; run scripts/translations.sh update"
    for po in po/*.po; do
        [ -e "$po" ] || continue
        msgfmt --check --statistics -o /dev/null "$po"
        # Every text the extension has, translated or not, and none it no longer has.
        diff -u <(msgcat --no-wrap --sort-output "$POT" | sed -n 's/^msgid //p') \
            <(msgattrib --no-obsolete --no-wrap --sort-output "$po" | sed -n 's/^msgid //p') >/dev/null ||
            fail "$po is not merged with $POT; run scripts/translations.sh update"
    done
    ;;
compile)
    dest="${2:-}"
    [ -d "$dest" ] || fail "compile needs the extension folder to put locale/ in"
    for po in po/*.po; do
        [ -e "$po" ] || continue
        lang="$(basename "$po" .po)"
        mkdir -p "$dest/locale/$lang/LC_MESSAGES"
        msgfmt --check -o "$dest/locale/$lang/LC_MESSAGES/$DOMAIN.mo" "$po"
    done
    ;;
*)
    echo "Usage: $0 update | check | compile <extension folder>" >&2
    exit 2
    ;;
esac
