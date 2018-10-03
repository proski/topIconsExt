// -*- mode: js2; indent-tabs-mode: nil; js2-basic-offset: 4 -*-

const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const Gio = imports.gi.Gio;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const _ = Gettext.gettext;

function init() {
	Convenience.initTranslations();
}

const TopIconsExtSettings = new GObject.Class({
	Name: 'TopIconsExtPrefs',
	Extends: Gtk.Grid,

	_init: function(params) {

		this.parent(params);
		this.margin = 24;
		this.spacing = 30;
		this.row_spacing = 10;
		this._settings = Convenience.getSettings();

		let label = null
		let widget = null;
		let value = null;
		let positionSetting = null;
		let positionButton = null;
		let radio = null;

		// Icon saturation
		label = new Gtk.Label({
			label: _('Desaturation (min: 0.0, max: 1.0)'),
			hexpand: true,
			halign: Gtk.Align.START
		});
		widget = new Gtk.SpinButton({halign:Gtk.Align.END, digits:1});
		widget.set_sensitive(true);
		widget.set_range(0.0, 1.0);
		widget.set_value(this._settings.get_double('icon-saturation'));
		widget.set_increments(0.1, 0.2);
		widget.connect('value-changed', Lang.bind(this, function(w){
			value = w.get_value();
			this._settings.set_double('icon-saturation', value);
		 }));
		this.attach(label, 0, 2, 1, 1);
		this.attach(widget, 1, 2, 1, 1);

		// Icon brightness
		label = new Gtk.Label({
			label: _('Brightness (min: -1.0, max: 1.0)'),
			hexpand: true,
			halign: Gtk.Align.START
		});
		widget = new Gtk.SpinButton({halign:Gtk.Align.END, digits:1});
		widget.set_sensitive(true);
		widget.set_range(-1.0, 1.0);
		widget.set_value(this._settings.get_double('icon-brightness'));
		widget.set_increments(0.1, 0.2);
		widget.connect('value-changed', Lang.bind(this, function(w){
			value = w.get_value();
			this._settings.set_double('icon-brightness', value);
		 }));
		this.attach(label, 0, 3, 1, 1);
		this.attach(widget, 1, 3, 1, 1);

		// Icon contrast
		label = new Gtk.Label({
			label: _('Contrast (min: -1.0, max: 1.0)'),
			hexpand: true,
			halign: Gtk.Align.START
		});
		widget = new Gtk.SpinButton({halign:Gtk.Align.END, digits:1});
		widget.set_sensitive(true);
		widget.set_range(-1.0, 1.0);
		widget.set_value(this._settings.get_double('icon-contrast'));
		widget.set_increments(0.1, 0.2);
		widget.connect('value-changed', Lang.bind(this, function(w){
			value = w.get_value();
			this._settings.set_double('icon-contrast', value);
		 }));
		this.attach(label, 0, 4, 1, 1);
		this.attach(widget, 1, 4, 1, 1);

		// Icon size
		label = new Gtk.Label({
			label: _('Icon size (min: 0, max: 96)'),
			hexpand: true,
			halign: Gtk.Align.START
		});
		widget = new Gtk.SpinButton({halign:Gtk.Align.END});
		widget.set_sensitive(true);
		widget.set_range(0, 96);
		widget.set_value(this._settings.get_int('icon-size'));
		widget.set_increments(1, 2);
		widget.connect('value-changed', Lang.bind(this, function(w){
			value = w.get_value_as_int();
			this._settings.set_int('icon-size', value);
		 }));
		this.attach(label, 0, 5, 1, 1);
		this.attach(widget, 1, 5, 1, 1);

		// Icon tray spacing
		label = new Gtk.Label({
			label: _('Spacing between icons (min: 0, max: 20)'),
			hexpand: true,
			halign: Gtk.Align.START
		});
		widget = new Gtk.SpinButton({halign:Gtk.Align.END});
		widget.set_sensitive(true);
		widget.set_range(0, 20);
		widget.set_value(this._settings.get_int('icon-spacing'));
		widget.set_increments(1, 2);
		widget.connect('value-changed', Lang.bind(this, function(w){
			value = w.get_value_as_int();
			this._settings.set_int('icon-spacing', value);
		 }));
		this.attach(label, 0, 6, 1, 1);
		this.attach(widget, 1, 6, 1, 1);
	},
});

function buildPrefsWidget() {
	let widget = new TopIconsExtSettings();
	widget.show_all();

	return widget;
}
