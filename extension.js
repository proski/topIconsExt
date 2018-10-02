// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Main = imports.ui.main;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Panel = imports.ui.panel;
const PanelMenu = imports.ui.panelMenu;
const Meta = imports.gi.Meta;
const Mainloop = imports.mainloop;
const NotificationDaemon = imports.ui.notificationDaemon;
const System = imports.system;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

let settings = null;
let trayAddedId = 0;
let trayRemovedId = 0;
let getSource = null;
let icons = [];
let notificationDaemon = null;
let sysTray = null;

let blacklist = [["skype","SkypeNotification@chrisss404.gmail.com"]]; // blacklist: array of [uuid, wmClass (icon application name)] pairs

function init() {
	if ( Main.legacyTray ) {
		notificationDaemon = Main.legacyTray;
		NotificationDaemon.STANDARD_TRAY_ICON_IMPLEMENTATIONS = imports.ui.legacyTray.STANDARD_TRAY_ICON_IMPLEMENTATIONS;
	} else if ( Main.notificationDaemon._fdoNotificationDaemon &&
				Main.notificationDaemon._fdoNotificationDaemon._trayManager ) {
		notificationDaemon = Main.notificationDaemon._fdoNotificationDaemon;
		getSource = Lang.bind(notificationDaemon, NotificationDaemon.FdoNotificationDaemon.prototype._getSource);
	} else if ( Main.notificationDaemon._trayManager ) {
		notificationDaemon = Main.notificationDaemon;
		getSource = Lang.bind(notificationDaemon, NotificationDaemon.NotificationDaemon.prototype._getSource);
	} else {
		NotificationDaemon.STANDARD_TRAY_ICON_IMPLEMENTATIONS = {
			'bluetooth-applet': 1, 'gnome-sound-applet': 1, 'nm-applet': 1,
			'gnome-power-manager': 1, 'keyboard': 1, 'a11y-keyboard': 1,
			'kbd-scrolllock': 1, 'kbd-numlock': 1, 'kbd-capslock': 1, 'ibus-ui-gtk': 1
		};
	}
}

function enable() {
	if (notificationDaemon)
		GLib.idle_add(GLib.PRIORITY_LOW, moveToTop);
	else
		createTray();

	settings = Convenience.getSettings();
	settings.connect('changed::icon-saturation', Lang.bind(this, setSaturation));
	settings.connect('changed::icon-brightness', Lang.bind(this, setBrightnessContrast));
	settings.connect('changed::icon-contrast', Lang.bind(this, setBrightnessContrast));
	settings.connect('changed::icon-size', Lang.bind(this, setSize));
	settings.connect('changed::icon-spacing', Lang.bind(this, setSpacing));
}

function disable() {
	if (notificationDaemon)
		moveToTray();
	else
		destroyTray();
}

function createSource(title, pid, ndata, sender, trayIcon) { 
	if (trayIcon) {
		onTrayIconAdded(this, trayIcon, title);
		return null;
	}

	return getSource(title, pid, ndata, sender, trayIcon);
};

function onTrayIconAdded(o, icon, role, delay=1000) {
	let wmClass = icon.wm_class ? icon.wm_class.toLowerCase() : '';
	if (NotificationDaemon.STANDARD_TRAY_ICON_IMPLEMENTATIONS[wmClass] !== undefined)
		return;
	for (let [wmClass, uuid] of blacklist) {
		if (ExtensionUtils.extensions[uuid] !== undefined &&
			ExtensionUtils.extensions[uuid].state === 1 &&
			iconWmClass === wmClass)
			return;
	}

	let iconContainer = new St.Button({child: icon, visible: false});

	icon.connect("destroy", function() {
		icon.clear_effects();
		iconContainer.destroy();
	});

	iconContainer.connect('button-release-event', function(actor, event) {
		icon.click(event);
	});

	GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, Lang.bind(this, function(){
		iconContainer.visible = true;
		iconsContainer.actor.visible = true;
		return GLib.SOURCE_REMOVE;
	}));

	let iconSize = setSize(icon);
	setSaturation(icon);
	setBrightnessContrast(icon);
	setSpacing(icon);

	icon.reactive = true;

	icons.push(icon);
	Main.panel._rightBox.insert_child_at_index(iconContainer, 0);

	let clickProxy = new St.Bin({ width: iconSize, height: iconSize });
	clickProxy.reactive = true;
	Main.uiGroup.add_actor(clickProxy);

	icon._proxyAlloc = Main.panel._rightBox.connect('allocation-changed', function() {
		Meta.later_add(Meta.LaterType.BEFORE_REDRAW, function() {
			let [x, y] = icon.get_transformed_position();
			clickProxy.set_position(x, y);
		});
	});

	icon.connect("destroy", function() {
		Main.panel._rightBox.disconnect(icon._proxyAlloc);
		clickProxy.destroy();
	});

	clickProxy.connect('button-release-event', function(actor, event) {
		icon.click(event);
	});

	icon._clickProxy = clickProxy;

	/* Fixme: HACK */
	Meta.later_add(Meta.LaterType.BEFORE_REDRAW, function() {
		let [x, y] = icon.get_transformed_position();
		clickProxy.set_position(x, y);
		return false;
	});
}

function onTrayIconRemoved(o, icon) {
	if ( icons.indexOf(icon) == -1 )
		return;
	let parent = icon.get_parent();
	if ( parent ) parent.destroy();
	icon.destroy();
	icons.splice(icons.indexOf(icon), 1);
}

function createTray() {
	sysTray = new Shell.TrayManager();
	sysTray.connect('tray-icon-added', onTrayIconAdded);
	sysTray.connect('tray-icon-removed', onTrayIconRemoved);
	sysTray.manage_screen(global.screen, Main.panel.actor);
}

function destroyTray() {
	icons.forEach(icon => { icon.get_parent().destroy(); });
	icons = [];
	sysTray = null;
	System.gc(); // force finalizing tray to unmanage screen
}

function moveToTop() {
	notificationDaemon._trayManager.disconnect(notificationDaemon._trayIconAddedId);
	notificationDaemon._trayManager.disconnect(notificationDaemon._trayIconRemovedId);
	trayAddedId = notificationDaemon._trayManager.connect('tray-icon-added', onTrayIconAdded);
	trayRemovedId = notificationDaemon._trayManager.connect('tray-icon-removed', onTrayIconRemoved);

	notificationDaemon._getSource = createSource;

	let toDestroy = [];
	if ( notificationDaemon._sources ) {
		for ( let i = 0; i < notificationDaemon._sources.length; i++ ) {
			let source = notificationDaemon._sources[i];
			if (!source.trayIcon)
				continue;
			let parent = source.trayIcon.get_parent();
			parent.remove_actor(source.trayIcon);
			onTrayIconAdded(this, source.trayIcon, source.initialTitle);
			toDestroy.push(source);
		}
	} else {
		for ( let i = 0; i < notificationDaemon._iconBox.get_n_children(); i++ ) {
			let button = notificationDaemon._iconBox.get_child_at_index(i);
			let icon = button.child;
			button.remove_actor(icon);
			onTrayIconAdded(this, icon, '');
			toDestroy.push(button);
		}
	}

	for ( let i = 0; i < toDestroy.length; i++ ) {
		toDestroy[i].destroy();
	}
}

function moveToTray() {
	if (trayAddedId != 0) {
		notificationDaemon._trayManager.disconnect(trayAddedId);
		trayAddedId = 0;
	}

	if (trayRemovedId != 0) {
		notificationDaemon._trayManager.disconnect(trayRemovedId);
		trayRemovedId = 0;
	}

	notificationDaemon._trayIconAddedId = notificationDaemon._trayManager.connect('tray-icon-added',
												Lang.bind(notificationDaemon, notificationDaemon._onTrayIconAdded));
	notificationDaemon._trayIconRemovedId = notificationDaemon._trayManager.connect('tray-icon-removed',
												Lang.bind(notificationDaemon, notificationDaemon._onTrayIconRemoved));

	notificationDaemon._getSource = getSource;

	for (let i = 0; i < icons.length; i++) {
		let icon = icons[i];
		let parent = icon.get_parent();
		if (icon._clicked) {
			icon.disconnect(icon._clicked);
		}
		icon._clicked = undefined;
		if (icon._proxyAlloc) {
			Main.panel._rightBox.disconnect(icon._proxyAlloc);
		}
		icon._clickProxy.destroy();
		parent.remove_actor(icon);
		parent.destroy();
		notificationDaemon._onTrayIconAdded(notificationDaemon, icon);
	}

	icons = [];
}

function setSaturation(icon) {
	let desaturationValue =  settings.get_double('icon-saturation');

	if (arguments.length == 1) {
		let sat_effect = new Clutter.DesaturateEffect({factor : desaturationValue});
		sat_effect.set_factor(desaturationValue);
		sat_effect.set_factor(desaturationValue);
		icon.add_effect_with_name('desaturate', sat_effect);
	} else {
		for (let i = 0; i < icons.length; i++) {
			 let icon = icons[i];
			 let effect = icon.get_effect('desaturate');
			 if (effect)
				effect.set_factor(desaturationValue);
		 }
	}
}

function setBrightnessContrast(icon) {
	let brightnessValue = settings.get_double('icon-brightness');
	let contrastValue =  settings.get_double('icon-contrast');

	if ( arguments.length == 1 ) {
		let bright_effect = new Clutter.BrightnessContrastEffect({});
		bright_effect.set_brightness(brightnessValue);
		bright_effect.set_contrast(contrastValue);
		icon.add_effect_with_name('brightness-contrast', bright_effect);
	} else {
		for ( let i = 0; i < icons.length; i++ ) {
			let icon = icons[i];
			let effect = icon.get_effect('brightness-contrast')
			effect.set_brightness(brightnessValue);
			effect.set_contrast(contrastValue);
		}
	}
}

function setSize(icon) {
	let iconSize = settings.get_int('icon-size');
	let scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;
	let _is = iconSize * scaleFactor;

	if ( arguments.length == 1 ) {
		icon.get_parent().set_size(_is, _is);
		icon.set_size(_is, _is);
	} else {
		for ( let i = 0; i < icons.length; i++ ) {
			let icon = icons[i];
			icon.get_parent().set_size(_is, _is);
			icon.set_size(_is, _is);
		}
	}

	return _is;
}

function setSpacing(icon) {
	let _isp = settings.get_int('icon-spacing');
	if ( arguments.length == 1 ) {
		icon.get_parent().set_style('margin: 0px '+_isp+'px;');
	} else {
		for ( let i = 0; i < icons.length; i++ ) {
			let icon = icons[i];
			icon.get_parent().set_style('margin: 0px '+_isp+'px;');
		}
	}
}
