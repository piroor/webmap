const ID = '{029C13D5-A40A-4eaa-921C-86DF550FB982}'; 

if (!window._elementIDs)
	var _elementIDs = [];

_elementIDs = _elementIDs.concat([
	'webmap.autolink.samedomain',
	'webmap.favicon.load_root_favicon',
	'webmap.ignore.query_string',
	'webmap.allow.schemer',
	'webmap.data.maxnodes',

	'webmap.world.scroll.button.autohide',
	'webmap.world.mode.auto_change',
	'webmap.world.mode.auto_change.scale',
	'webmap.view.vertexrelation.enabled',

	'webmap.image.type',
	'webmap.thumbnail.irfanview.path',
	'webmap.thumbnail.imagemagick.path'
]);

function controlLinkedItems(elem, aShouldEnable, aAttr)
{
	var target = elem.getAttribute(aAttr || 'linked').split(/ +/);
	var item;

	var disabled = (aShouldEnable !== void(0)) ? !aShouldEnable :
				(elem.localName == 'textbox') ? (!elem.value || !Number(elem.value)) :
				elem.localName == 'radio' ? !elem.selected :
				!elem.checked;

	for (var i in target)
	{
		item = document.getElementById(target[i]);
		if (item) item.disabled = disabled;
	}
}
 
// About 
const WindowManager = Components.classes['@mozilla.org/appshell/window-mediator;1'].getService(Components.interfaces.nsIWindowMediator);
function opener()
{
	return WindowManager.getMostRecentWindow('navigator:browser');
}

function loadURI(uri)
{
	if (opener())
		opener().loadURI(uri);
	else
		window.open(uri);
}
 
// Uninstall 
var unreg = new exUnregisterer(
	'chrome://webmap/content/contents.rdf',
	'jar:%chromeFolder%webmap.jar!/locale/en-US/webmap/contents.rdf',
	'jar:%chromeFolder%webmap.jar!/locale/ja-JP/webmap/contents.rdf',
	'jar:%chromeFolder%webmap.jar!/skin/classic/webmap/contents.rdf'
);
var STRBUNDLE = Components.classes['@mozilla.org/intl/stringbundle;1'].getService(Components.interfaces.nsIStringBundleService);
var msg = STRBUNDLE.createBundle('chrome://webmap/locale/webmap.properties');


function Unregister()
{
	if (!confirm(msg.GetStringFromName('uninstall_confirm'))) return;

	if (!confirm(msg.GetStringFromName('uninstall_prefs_confirm')))
		window.unreg.removePrefs('webmap');

	window.unreg.unregister();

	alert(
		msg.GetStringFromName('uninstall_removefile').replace(/%S/i,
			window.unreg.getFilePathFromURLSpec(
				(window.unreg.exists(window.unreg.UChrome+'webmap.jar') ? window.unreg.UChrome+'webmap.jar' : window.unreg.Chrome+'webmap.jar' )
			)
		)
	);

	window.close();
}
 
// choose file 
function chooseFileFor(aID, aMode, aChooserTitle, aDefaultString, aFilter)
{
	const nsIFilePicker = Components.interfaces.nsIFilePicker;
	const FP = Components.classes['@mozilla.org/filepicker;1'].createInstance(nsIFilePicker);

	FP.init(window, aChooserTitle, aMode);

	if (aDefaultString)
		FP.defaultString = aDefaultString;

	if (aFilter)
		FP.appendFilters(aFilter);

	var flag = FP.show();
	if (flag & nsIFilePicker.returnCancel) return;

	var path;
	try {
		path = FP.file.QueryInterface(Components.interfaces.nsILocalFile).path;
	}
	catch(e) {
		return;
	}

	document.getElementById(aID).value = path;
}
 
var prefService = { 
	kSupportsString : ('@mozilla.org/supports-wstring;1' in Components.classes) ? '@mozilla.org/supports-wstring;1' : '@mozilla.org/supports-string;1' ,
	knsISupportsString : ('nsISupportsWString' in Components.interfaces) ? Components.interfaces.nsISupportsWString : Components.interfaces.nsISupportsString,

	get Prefs()
	{
		if (!this._Prefs) {
			this._Prefs = Components.classes['@mozilla.org/preferences;1'].getService(Components.interfaces.nsIPrefBranch);
		}
		return this._Prefs;
	},
	_Prefs : null,

	getPref : function(aPrefstring)
	{
		try {
			var type = this.Prefs.getPrefType(aPrefstring);
			switch (type)
			{
				case this.Prefs.PREF_STRING:
					return this.Prefs.getComplexValue(aPrefstring, this.knsISupportsString).data;
					break;
				case this.Prefs.PREF_INT:
					return this.Prefs.getIntPref(aPrefstring);
					break;
				default:
					return this.Prefs.getBoolPref(aPrefstring);
					break;
			}
		}
		catch(e) {
		}

		return null;
	},

	setPref : function(aPrefstring, aNewValue)
	{
		var type;
		try {
			type = typeof aNewValue;
		}
		catch(e) {
			type = null;
		}

		switch (type)
		{
			case 'string':
				var string = Components.classes[this.kSupportsString].createInstance(this.knsISupportsString);
				string.data = aNewValue;
				this.Prefs.setComplexValue(aPrefstring, this.knsISupportsString, string);
				break;
			case 'number':
				this.Prefs.setIntPref(aPrefstring, parseInt(aNewValue));
				break;
			default:
				this.Prefs.setBoolPref(aPrefstring, aNewValue);
				break;
		}
		return true;
	},

	clearPref : function(aPrefstring)
	{
		try {
			this.Prefs.clearUserPref(aPrefstring);
		}
		catch(e) {
		}

		return;
	}
};
 
