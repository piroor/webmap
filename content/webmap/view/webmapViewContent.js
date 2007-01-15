window.__defineGetter__('WebMapService', function() {
	return window.parent.WebMapService;
});
window.__defineGetter__('WebMapView', function() {
	return window.parent.WebMapView;
});
window.__defineGetter__('WebMapCommand', function() {
	return window.parent.WebMapCommand;
});
window.__defineGetter__('WebMapViewUI', function() {
	return window.parent.WebMapViewUI;
});
