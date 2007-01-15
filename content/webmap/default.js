// general

pref("webmap.enabled", true);

// this will be updated automatically.
pref("webmap.hostwindow.types", "navigator:browser,webmap:view");

pref("webmap.data.path",  "");
pref("webmap.data.split", true); // split datasources for each domain

pref("webmap.data.maxnodes",  1024);

pref("webmap.redraw.interval", 100);

pref("webmap.autolink.samedomain", false);

pref("webmap.allow.schemer", "http,https,ftp");

pref("webmap.ignore.query_string",      true); // cuts "?***" string from URI
pref("webmap.ignore.identifier_string", true); // cuts "#***" string from URI

// 0:none 1:favicon 2:thumbnail
pref("webmap.image.type",    1);
pref("webmap.image.timeout", 10000);

pref("webmap.favicon.cache.enabled",     true);
pref("webmap.favicon.cache.file",        true);
pref("webmap.favicon.load_root_favicon", true);

pref("webmap.thumbnail.maxWidth",            100);
pref("webmap.thumbnail.maxHeight",           100);
pref("webmap.thumbnail.irfanview.path",      "");
pref("webmap.thumbnail.captor.command",      ""); // %s:filepath of tempfile
pref("webmap.thumbnail.temp.extension",      "bmp");
pref("webmap.thumbnail.imagemagick.convert", "");
pref("webmap.thumbnail.imagemagick.path",    "");


pref("webmap.world.mode",                   "all");
pref("webmap.world.mode.auto_change",       true);
pref("webmap.world.mode.auto_change.scale", 100);


// zoom

pref("webmap.world.scale",         100); // 100 = 100% = 1.0
pref("webmap.world.scale.min",     1);
pref("webmap.world.scale.max",     1000);
pref("webmap.world.scale.preset",  "10,33,50,100,200,300,600,900");

pref("webmap.world.scale.wheel.reverse",   false);
pref("webmap.world.scale.drag.reverse",    false);
pref("webmap.world.scale.step",            10);
pref("webmap.world.scale.wheel.power",     "1.2");
pref("webmap.world.scale.zoomInOut.power", "1.5");
pref("webmap.world.scale.drag.power",      "0.1");



// pan/scroll

pref("webmap.world.x",             "0");
pref("webmap.world.y",             "0");

pref("webmap.world.scroll.steps",       5);
pref("webmap.world.scroll.step.wheel",  24);
pref("webmap.world.scroll.step.button", 24);
pref("webmap.world.scroll.step.key",    32);

pref("webmap.world.scroll.button.autohide",       true);
pref("webmap.world.scroll.button.autohide.delay", 100);
pref("webmap.world.scroll.button.autohide.area",  48);
pref("webmap.world.scroll.button.start_timeout",  750);
pref("webmap.world.scroll.button.repeat",         100);
pref("webmap.world.scroll.button.offset",         3);
pref("webmap.world.scroll.button.offset.corner",  10);

pref("webmap.world.rotation",      0);
pref("webmap.world.rotation.step", 5);
pref("webmap.world.rotation.drag.power ",  "0.1");
pref("webmap.world.rotation.drag.reverse", false);
pref("webmap.world.rotation.reverse",      false);

pref("webmap.world.autoscroll.onload",         true);
pref("webmap.world.autoscroll.onfocus.window", false); // not implemented
pref("webmap.world.autoscroll.onfocus.tab",    true);


pref("webmap.auto_position.grid.10",  16);  // related, same domain
pref("webmap.auto_position.grid.20", 128); // related, similar domain
pref("webmap.auto_position.grid.30", 256); // related, similar contents (google)
pref("webmap.auto_position.grid.40", 512); // related, foreign domain
pref("webmap.auto_position.grid.50", 896); // unrelated domain
pref("webmap.auto_position.rotate", 30);
/*
	Following is the minimum rotation from another node which is related to
	the base node.
	If the base node has linked nodes fewer than Math.round(960/min_r)
*/
pref("webmap.auto_position.min_r",  100);  


// view, appearance

pref("webmap.view.vertexrelation.enabled", true);
pref("webmap.view.vertexrelation.level",   3);

pref("webmap.view.move_with_child_nodes", false);

pref("webmap.view.autoload.goto_from_arc", true);
pref("webmap.view.autoload.foundNode",     true);

pref("webmap.status.pan",        false);
pref("webmap.status.node_move",  false);
pref("webmap.status.delay.hide", 8000);

pref("webmap.menu.domain_nodes_list.width", 25);
pref("webmap.contextmenu.node_menu.width", 25);

pref("webmap.node.label.size",       20);
pref("webmap.arc.marker.size",       12);
pref("webmap.arc.marker.delay.hide", 5000);

pref("webmap.view.autoCollapse",    true);
pref("webmap.view.collapsed",       false);
pref("webmap.view.contentHeight",   0);
pref("webmap.view.alwaysRaised",    true);
pref("webmap.view.sync_open_state.enabled",      true);
pref("webmap.view.sync_open_state.shouldShow",   true);
pref("webmap.view.sync_minimize_state.enabled",  true);
pref("webmap.view.sync_minimize_state.interval", 200);

pref("webmap.view.throbber.url", "http://piro.sakura.ne.jp/xul/webmap/");


pref("browser.toolbars.showbutton.toggleWebMapView", true); // for Mozilla Suite

