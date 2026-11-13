// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 zickrian

// Isle: a notch-style island for the GNOME top bar. The extension only draws;
// isled (the Rust daemon) tracks media, timers and system state over D-Bus.

import Gio from 'gi://Gio';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {Controller} from './src/controller.js';
import {setLanguage, setTranslations} from './src/i18n.js';
import {releaseIconTheme, setIconDir} from './src/widgets.js';

/** The entry point GNOME Shell loads; everything else hangs off the controller. */
export default class IsleExtension extends Extension {
    /** Isle's words in the user's language (locale/, from po/), before anything is drawn. */
    constructor(metadata) {
        super(metadata);
        this.initTranslations();
        setTranslations(this, path => Gio.File.new_for_path(path).load_contents(null)[1]);
    }

    /** Icons first: the widgets the controller builds look them up. */
    enable() {
        setIconDir(this.dir.get_child('icons'));
        this._settings = this.getSettings();
        setLanguage(this._settings.get_string('language'));
        this._controller = new Controller(this);
        this._langChanged = this._settings.connect('changed::language', () => {
            setLanguage(this._settings.get_string('language'));
            this._controller?.destroy({keepOperations: true});
            this._controller = new Controller(this);
        });
    }

    /** Takes the island down; GNOME also calls this when the screen locks. */
    disable() {
        if (this._langChanged)
            this._settings?.disconnect(this._langChanged);
        this._langChanged = 0;
        this._settings = null;
        this._controller?.destroy();
        this._controller = null;
        releaseIconTheme();
    }
}
