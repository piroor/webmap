// start of definition 
if (!window.WebMapService) {

var WebMapService = {
	debug : true,

	activated : false,
	view      : null,

	mCachedDataSources : null,
	
	// 定数 
	NS : 'http://piro.sakura.ne.jp/rdf/webmap#',

	kNC_URL               : 'http://home.netscape.com/NC-rdf#URL',
	kNC_Name              : 'http://home.netscape.com/NC-rdf#Name',
	kNC_Icon              : 'http://home.netscape.com/NC-rdf#Icon',
	kWEB_LastVisitedDate  : 'http://home.netscape.com/WEB-rdf#LastVisitDate',
	kWEB_LastModifiedDate : 'http://home.netscape.com/WEB-rdf#LastModifiedDate',

	kSupportsString : ('@mozilla.org/supports-wstring;1' in Components.classes) ? '@mozilla.org/supports-wstring;1' : '@mozilla.org/supports-string;1' ,
	knsISupportsString : ('nsISupportsWString' in Components.interfaces) ? Components.interfaces.nsISupportsWString : Components.interfaces.nsISupportsString,

	nsIWindowMediator : Components.classes['@mozilla.org/appshell/window-mediator;1'].getService(Components.interfaces.nsIWindowMediator),
	nsIRDFService : Components.classes['@mozilla.org/rdf/rdf-service;1'].getService(Components.interfaces.nsIRDFService),
	nsIIOService : Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService),

	isWin32 : (navigator.platform.indexOf('Win') > -1),
 
	// references 
	
	get browser() 
	{
		var nav = this.browserWindow;
		return nav ? nav.gBrowser : null ;
	},
	
	get browserWindow() 
	{
		return this.getTopWindowOf('navigator:browser');
	},
 
	get browserWindows() 
	{
		return this.getWindowsOf('navigator:browser');
	},
 
	get hostWindows() 
	{
		var types   = this.getPref('webmap.hostwindow.types');
		var current = document.documentElement.getAttribute('windowtype');
		if ((','+types+',').indexOf(','+current+',') < 0) {
			types += ','+current;
			this.setPref('webmap.hostwindow.types', types);
		}
		return this.getWindowsOf(types.split(','));
	},
  
	get isNewTypeBrowser() 
	{
		return this.browserURI.match(/^chrome:\/\/browser\//) ? true : false ;
	},
	
	get browserURI() 
	{
		if (!this._browserURI) {
			var uri = this.getPref('browser.chromeURL');
			if (!uri) {
				try {
					var handler = Components.classes['@mozilla.org/commandlinehandler/general-startup;1?type=browser'].getService(Components.interfaces.nsICmdLineHandler);
					uri = handler.chromeUrlForTask;
				}
				catch(e) {
				}
			}
			if (uri.charAt(uri.length-1) == '/')
				uri = uri.replace(/chrome:\/\/([^\/]+)\/content\//, 'chrome://$1/content/$1.xul');
			this._browserURI = uri;
		}
		return this._browserURI;
	},
	_browserURI : null,
  
	get rootDataSource() 
	{
		if (!this.rootDataSourcePointer) {
			this.rootDataSourcePointer = this.getDataSourceForKey('webmap');
		}
		return this.rootDataSourcePointer;
	},
	rootDataSourcePointer : null,
	
	get rootDataSourceURI() 
	{
		var dataFile = this.getFileFromURLSpec(this.dataDirURI+'webmap.rdf');
		if (!dataFile.exists())
			dataFile.create(dataFile.NORMAL_FILE_TYPE, 0644);

		return this.dataDirURI+'webmap.rdf';
	},
 
	get dataDirURI() 
	{
		var path = this.getPref('webmap.data.path');
		if (this._dataDirURILastPath && this._dataDirURILastPath != path) {
			this._dataDirURI = null;
		}

		if (!this._dataDirURI) {
			var localDir = Components.classes['@mozilla.org/file/local;1'].createInstance(Components.interfaces.nsILocalFile);

			if (!path) {
				const DIR = Components.classes['@mozilla.org/file/directory_service;1'].getService(Components.interfaces.nsIProperties);
				var dir = DIR.get('ProfD', Components.interfaces.nsILocalFile);
				path = dir.path;
			}
			localDir.initWithPath(path);

			var uri;
			try {
				uri = this.nsIIOService.newFileURI(localDir).spec;
			}
			catch(e) { // [[interchangeability for Mozilla 1.1]]
				uri = this.nsIIOService.getURLSpecFromFile(localDir);
			}

			if (!uri.match(/\/$/)) uri += '/';
			if (!this.getPref('webmap.data.path')) uri += 'webmap/';

			var dataDir = this.getFileFromURLSpec(uri);
			if (!dataDir.exists())
				dataDir.create(dataDir.DIRECTORY_TYPE, 0755);

			this._dataDirURI = uri;
		}
		return this._dataDirURI;
	},
	_dataDirURI : null,
	_dataDirURILastPath : null,
 
	get rootContainer() 
	{
		return this.getRDFSeqContainer(this.rootDataSource, this.rootContainerNode);
	},
	
	get rootContainerNode() 
	{
		return this.nsIRDFService.GetResource(this.NS+'urn:webmap:root');
	},
  
	addRootEntry : function(aURI) 
	{
		this.appendEntryTo(this.rootContainer, this.getResource(aURI));
	},
 
	removeRootEntry : function(aURI, aInfo) 
	{
		this.removeEntryFrom(this.rootContainer, this.getResource(aURI), aInfo);
	},
  
	get nsIObserverService() 
	{
		if (!this._nsIObserverService) {
			this._nsIObserverService = Components.classes['@mozilla.org/observer-service;1'].getService(Components.interfaces.nsIObserverService);
		}
		return this._nsIObserverService;
	},
	_nsIObserverService : null,
  
	// common methods 
	
	get Prefs() 
	{
		if (!this._Prefs) {
			this._Prefs = Components.classes['@mozilla.org/preferences;1'].getService(Components.interfaces.nsIPrefBranch);
		}
		return this._Prefs;
	},
	_Prefs : null,
	
	getPref : function(aPrefstring, aPrefBranch) 
	{
		var branch = aPrefBranch || this.Prefs;

		try {
			var type = branch.getPrefType(aPrefstring);
			switch (type)
			{
				case this.Prefs.PREF_STRING:
					return branch.getComplexValue(aPrefstring, this.knsISupportsString).data;
					break;
				case this.Prefs.PREF_INT:
					return branch.getIntPref(aPrefstring);
					break;
				default:
					return branch.getBoolPref(aPrefstring);
					break;
			}
		}
		catch(e) {
//			if (this.debug) alert(e+'\n\nCannot load "'+aPrefstring+'" as "'+type+'"');
		}

		return null;
	},
 
	setPref : function(aPrefstring, aNewValue, aPrefBranch) 
	{
		var type;
		try {
			type = typeof aNewValue;
		}
		catch(e) {
			type = null;
	//		if (this.debug) alert(e+'\n\n'+aPrefstring);
		}

		var branch = aPrefBranch || this.Prefs;

		switch (type)
		{
			case 'string':
				var string = Components.classes[this.kSupportsString].createInstance(this.knsISupportsString);
				string.data = aNewValue;
				branch.setComplexValue(aPrefstring, this.knsISupportsString, string);
				break;
			case 'number':
				branch.setIntPref(aPrefstring, parseInt(aNewValue));
				break;
			default:
				branch.setBoolPref(aPrefstring, aNewValue);
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
	},
  
	getTopWindowOf : function(aWindowType) 
	{
		return this.nsIWindowMediator.getMostRecentWindow(aWindowType) || null ;
	},
	
	getWindowsOf : function(aWindowTypes) 
	{
		if (typeof aWindowTypes == 'string')
			aWindowTypes = [aWindowTypes];

		var targetWindows = [],
			done = {};
		var targets,
			target;
		for (var i in aWindowTypes)
		{
			if (aWindowTypes[i] in done) continue;
			done[aWindowTypes[i]] = true;

			targets = this.nsIWindowMediator.getEnumerator(aWindowTypes[i], true);
			while (targets.hasMoreElements())
			{
				target = targets.getNext().QueryInterface(Components.interfaces.nsIDOMWindowInternal);
				targetWindows.push(target);
			}
		}

		return targetWindows;
	},
  
	makeURIFromSpec : function(aURI) 
	{
		try {
			var newURI;
			aURI = aURI || '';
			if (aURI && aURI.match(/^file:/)) {
				var tempLocalFile;
				try {
					var fileHandler = this.nsIIOService.getProtocolHandler('file').QueryInterface(Components.interfaces.nsIFileProtocolHandler);
					tempLocalFile = fileHandler.getFileFromURLSpecSpec(aURI);
				}
				catch(ex) { // [[interchangeability for Mozilla 1.1]]
					try {
						tempLocalFile = this.nsIIOService.getFileFromURLSpecSpec(aURI);
					}
					catch(ex) { // [[interchangeability for Mozilla 1.0.x]]
						tempLocalFile = Components.classes['@mozilla.org/file/local;1'].createInstance(Components.interfaces.nsILocalFile);
						this.nsIIOService.initFileFromURLSpec(tempLocalFile, aURI);
					}
				}
				newURI = this.nsIIOService.newFileURI(tempLocalFile); // we can use this instance with the nsIFileURL interface.
			}
			else {
				newURI = this.nsIIOService.newURI(aURI, null, null);
			}

			return newURI;
		}
		catch(e){
		}
		return null;
	},
 
	getFileFromURLSpec : function(aURL) 
	{
		var tempLocalFile;
		try {
			var fileHandler = this.nsIIOService.getProtocolHandler('file').QueryInterface(Components.interfaces.nsIFileProtocolHandler);
			tempLocalFile = fileHandler.getFileFromURLSpec(aURL);
		}
		catch(e) { // [[interchangeability for Mozilla 1.1]]
			try {
				tempLocalFile = this.nsIIOService.getFileFromURLSpec(aURL);
			}
			catch(ex) { // [[interchangeability for Mozilla 1.0.x]]
				tempLocalFile = Components.classes['@mozilla.org/file/local;1'].createInstance(Components.interfaces.nsILocalFile);
				this.nsIIOService.initFileFromURLSpec(tempLocalFile, aURL);
			}
		}
		return tempLocalFile;
	},
 
	getURLFromFilePath : function(aFilePath) 
	{
		var tempLocalFile = Components.classes['@mozilla.org/file/local;1']
								.createInstance(Components.interfaces.nsILocalFile);
		tempLocalFile.initWithPath(aFilePath);

		try {
			return this.nsIIOService.newFileURI(tempLocalFile);
		}
		catch(e) { // for Mozilla 1.0～1.1
			var spec;
			try {
				spec = this.nsIIOService.getURLSpecFromFile(tempLocalFile);
			} catch(ex) { // for NS6
				spec = tempLocalFile.URL;
			}
			return this.makeURIFromSpec(spec);
		}
	},
 
	getDocShellFromDocument : function(aDocument, aRootDocShell) 
	{
		const kDSTreeNode = Components.interfaces.nsIDocShellTreeNode;
		const kDSTreeItem = Components.interfaces.nsIDocShellTreeItem;
		const kWebNav     = Components.interfaces.nsIWebNavigation;

		if (aDocument.defaultView)
			return aDocument.defaultView.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
					.getInterface(kWebNav)
					.QueryInterface(Components.interfaces.nsIDocShell);

		if (!aRootDocShell)
			aRootDocShell = this.browser ? this.browser.docShell : null ;
		if (!aRootDocShell)
			return null;

		aRootDocShell = aRootDocShell
				.QueryInterface(kDSTreeNode)
				.QueryInterface(kDSTreeItem)
				.QueryInterface(kWebNav);
		var docShell = aRootDocShell;
		traceDocShellTree:
		do {
			if (docShell.document == aDocument) {
				return docShell;
				break;
			}

			if (docShell.childCount) {
				docShell = docShell.getChildAt(0);
				docShell = docShell
					.QueryInterface(kDSTreeNode)
					.QueryInterface(kWebNav);
			}
			else {
				parentDocShell = docShell.parent.QueryInterface(kDSTreeNode);
				while (docShell.childOffset == parentDocShell.childCount-1)
				{
					docShell = parentDocShell;
					if (docShell == aRootDocShell || !docShell.parent)
						break traceDocShellTree;
					parentDocShell = docShell.parent.QueryInterface(kDSTreeNode);
				}
				docShell = parentDocShell.getChildAt(docShell.childOffset+1)
					.QueryInterface(kDSTreeNode)
					.QueryInterface(kWebNav);
			}
		} while (docShell != aRootDocShell);

		return null;
	},
 
	lookupMethod : function(aObject, aProperty) 
	{
		try {
			return Components.lookupMethod(aObject, aProperty).call(aObject);
		}
		catch(e) {
			throw e;
		}
	},
 
	sanitizeURI : function(aURI) 
	{
		var uri = String(aURI);

		if (this.getPref('webmap.ignore.identifier_string'))
			uri = uri.replace(/#.*$/, '');
		if (this.getPref('webmap.ignore.query_string'))
			uri = uri.replace(/\?[^#]*/, '');

		return uri;
	},
 
	getParentDomain : function(aDomain) 
	{
		var domainParts = aDomain.split('.');
		var domain;
		if (domainParts.length > 3) {
			// www.foobar.co.jp => foobar.co.jp
			domain = domainParts[domainParts.length-3]+'.'+
						domainParts[domainParts.length-2]+'.'+
						domainParts[domainParts.length-1];
		}
		else if (domainParts.length > 2) {
			// www.foobar.jp => foobar.jp
			// foobar.co.jp  => co.jp (this seems to be an invalid result...)
			domain = domainParts[domainParts.length-2]+'.'+
						domainParts[domainParts.length-1];
		}
		else {
			// foobar.jp => foobar
			domain = domainParts[0];
		}
		return domain;
	},
 
	notifyObservers : function(aTopic, aData) 
	{
		this.nsIObserverService.notifyObservers(window, aTopic, aData);
	},
 
	runProcess : function(aExeFilePath, aArguments, aWait) 
	{
		if (!aArguments) aArguments = '';
		if (aArguments.constructor != Array)
			aArguments = this.splitCommandLineText(aArguments);

		var process = Components.classes['@mozilla.org/process/util;1']
						.createInstance(Components.interfaces.nsIProcess);

		var exeFile = Components.classes['@mozilla.org/file/local;1']
						.createInstance(Components.interfaces.nsILocalFile);
		exeFile.initWithPath(aExeFilePath);

		process.init(exeFile);
		process.run(aWait, aArguments, aArguments.length, {});
		return process;
	},
	
	splitCommandLineText : function(aText) 
	{
		var tmp_arg    = aText.toString().split(/ +/),
			inner_quot = false,
			tmp_value;

		aText = [];
		for (var i in tmp_arg)
		{
			tmp_arg[i] = tmp_arg[i].replace(/"([^"]*)"/g, '$1');

			if (tmp_arg[i].charAt(0) != '"' && !inner_quot) aText.push(tmp_arg[i]);

			if (inner_quot) {
				tmp_value = tmp_value+' '+tmp_arg[i];
				if (tmp_value.charAt(tmp_value.length-1) == '"') {
					aText.push(tmp_value.substring(0, tmp_value.length-1));
					inner_quot = false;
				}
			}
			if (tmp_arg[i].charAt(0) == '"') {
				inner_quot = true;
				tmp_value = tmp_arg[i].substring(1, tmp_arg[i].length);
			}
		}

		return aText;
	},
  
	createThumbnailFor : function(aURI, aImageFilePath) 
	{
try{
		var captor      = this.getPref('webmap.thumbnail.captor.command');
		var irfanview   = this.isWin32 ? this.getPref('webmap.thumbnail.irfanview.path') : null ;
		var imagemagick = this.getPref('webmap.thumbnail.imagemagick.path');
		if (
			!irfanview &&
			((this.isWin32 && !captor) || !imagemagick)
			)
			return false;

		var b = this.browser;
		if (!b) return false;

		b = b.getBrowserForTab(b.selectedTab)

		var isImage = b.contentDocument.contentType.match(/^image\/([^\+]+)(\+xml)?$/i);

		// この部分、フレーム対応に書き直さないといけませんなあ……（気が進まんけど）
		if (!isImage &&
			this.sanitizeURI(aURI) != this.sanitizeURI(b.currentURI.spec))
			return false;


		var tempfile = aImageFilePath;
		if (isImage) {
			var extension = RegExp.$1;
			if (extension.toLowerCase() == 'jpeg') extension = 'jpg';
			tempfile = aImageFilePath+'.'+extension;

			const nsIWebBrowserPersist = Components.interfaces.nsIWebBrowserPersist;
			var persist = Components.classes['@mozilla.org/embedding/browser/nsWebBrowserPersist;1'].createInstance(nsIWebBrowserPersist);
			persist.persistFlags = nsIWebBrowserPersist.PERSIST_FLAGS_NO_CONVERSION | nsIWebBrowserPersist.PERSIST_FLAGS_REPLACE_EXISTING_FILES | nsIWebBrowserPersist.PERSIST_FLAGS_FROM_CACHE;

			var uri = this.makeURIFromSpec(aURI);
			var file = Components.classes['@mozilla.org/file/local;1']
						.createInstance(Components.interfaces.nsILocalFile);
			file.initWithPath(tempfile);
//			if (persist.saveURI.arity == 3) // old implementation
//				persist.saveURI(uri, null, tempfile);
//			else
				persist.saveURI(uri, null, null, null, null, file);

			var start_time = (new Date()).getTime();
			var timeout = WebMapService.getPref('webmap.image.timeout');
			var timer = window.setInterval(function() {
				if ((new Date()).getTime() - start_time >= timeout) {
					window.clearInterval(timer);
					return;
				}

				if (persist.currentState != nsIWebBrowserPersist.PERSIST_STATE_FINISHED)
					return;

				window.clearInterval(timer);
				WebMapService.createThumbnailForCallback(aURI, tempfile, aImageFilePath);
			}, 100);
		}
		else {
			tempfile = aImageFilePath+'.'+(this.getPref('webmap.thumbnail.temp.extension') || 'tmp');

			var box = b.boxObject;
			var extraCommand = {
				crop : {
					x      : box.screenX,
					y      : box.screenY,
					width  : box.width,
					height : box.height
				}
			};

			// capture
			if (irfanview) {
				tempfile = null;
				extraCommand.capture = { action : 0 };
			}
			else {
				if (this.isWin32) {
					captor = captor.replace(/%s/i, tempfile);
					captor = this.splitCommandLineText(captor);
					captorExe = captor.shift();
					this.runProcess(captorExe, captor, true);
				}
				else {
					tempfile = null;
					extraCommand.capture = { action : 'root' };
				}
			}

			this.createThumbnailForCallback(aURI, tempfile, aImageFilePath, extraCommand);
		}
}
catch(e){
	alert('WebMapService.createThumbnailFor()\n'+e);
}

		return true;
	},
	createThumbnailForCallback : function(aURI, aTempFilePath, aImageFilePath, aExtraCommand)
	{
		var extraCommand = '';

		var irfanview = this.isWin32 ? this.getPref('webmap.thumbnail.irfanview.path') : null ;

		if (irfanview) {
			if (aExtraCommand && aExtraCommand.capture)
				extraCommand += ' /capture='+aExtraCommand.capture.action;
			else
				extraCommand += '"'+aTempFilePath+'"';

			if (aExtraCommand && aExtraCommand.crop)
				extraCommand += [' /crop=(',
						aExtraCommand.crop.x,
						',',
						aExtraCommand.crop.y,
						',',
						aExtraCommand.crop.width,
						',',
						aExtraCommand.crop.height,
						')',
					].join('');

			this.runProcess(
				irfanview,
				[
					extraCommand,

					' /aspectratio /resample=(',
						this.getPref('webmap.thumbnail.maxWidth'),
						',',
						this.getPref('webmap.thumbnail.maxHeight'),
						')',

					' /convert='+aImageFilePath
				].join(''),
				true
			);
		}
		else {
			var imagemagick = this.getPref('webmap.thumbnail.imagemagick.path');
			imagemagick = this.getURLFromFilePath(imagemagick).spec;
			imagemagick = imagemagick.replace(/([^\/])$/, '$1/');

			var command;
			if (aExtraCommand && aExtraCommand.capture) {
				command = imagemagick+'import';
				extraCommand += ' '+aExtraCommand.capture.action;
			}
			else {
				command = imagemagick+'convert';
				extraCommand += ' "'+aTempFilePath+'"';
			}

			if (this.isWin32) command += '.exe';
			command = this.getFileFromURLSpec(command).path;

			if (aExtraCommand && aExtraCommand.crop)
				extraCommand += [' -crop ',
						aExtraCommand.crop.width,
						'x',
						aExtraCommand.crop.height,
						'+',
						aExtraCommand.crop.x,
						'+',
						aExtraCommand.crop.y
					].join('');

			this.runProcess(
				command,
				[
					extraCommand,

					' -resize ',
						this.getPref('webmap.thumbnail.maxWidth'),
						'x',
						this.getPref('webmap.thumbnail.maxHeight'),

					' "'+aImageFilePath+'"'
				].join(''),
				true
			);
		}

		if (aTempFilePath) {
			var tempFileObj = Components.classes['@mozilla.org/file/local;1']
								.createInstance(Components.interfaces.nsILocalFile);
			tempFileObj.initWithPath(aTempFilePath);
			tempFileObj.remove(true);
		}

		this.notifyObservers(
			'webmap:service:node-operation',
			'update\nthumbnail\n'+aURI
		);
	},
  
	// operate RDF data sources 
	
	// Resource 
	
	getResource : function(aID) 
	{
		var res;
		try {
			if (aID && 'QueryInterface' in aID)
				res = aID.QueryInterface(Components.interfaces.nsIRDFResource);
		}
		catch(e) {
		}
		if (!res) {
			res = this.nsIRDFService.GetResource(aID);
		}

		return res;
	},
 
	getTarget : function(aDataSource, aNode, aKey) 
	{
		if (!aDataSource || !aNode || !aKey) return null;

		aNode = this.getResource(aNode);
		aKey  = this.getResource(aKey);

		var target = aDataSource.GetTarget(aNode, aKey, true);
		try {
			if (target)
				target = target.QueryInterface(Components.interfaces.nsIRDFResource);
			return target;
		}
		catch(e) {
		}
		return null;
	},
 
	getTargets : function(aDataSource, aNode, aKey) 
	{
		if (!aDataSource || !aNode || !aKey) return null;

		aNode = this.getResource(aNode);
		aKey  = this.getResource(aKey);

		return aDataSource.GetTargets(aNode, aKey, true);
	},
 
	setTargetTo : function(aDataSource, aNode, aKey, aTarget) 
	{
		if (!aDataSource || !aNode || !aKey || !aTarget) return false;

		try {
			aNode   = this.getResource(aNode);
			aKey    = this.getResource(aKey);
			aTarget = this.getResource(aTarget);
			var old = aDataSource.GetTarget(aNode, aKey, true);
			if (old) {
				if (old.QueryInterface(Components.interfaces.nsIRDFResource).Value == aTarget.Value)
					return true;
				else
					aDataSource.Change(aNode, aKey, old, aTarget);
			}
			else
				aDataSource.Assert(aNode, aKey, aTarget, true);
		}
		catch(e) {
			return false;
		}
		this.flushDataSource(aDataSource);
		return true;
	},
 
	addTargetTo : function(aDataSource, aNode, aKey, aTarget) 
	{
		if (!aDataSource || !aNode || !aKey || !aTarget) return false;

		try {
			aNode   = this.getResource(aNode);
			aKey    = this.getResource(aKey);
			aTarget = this.getResource(aTarget);
			aDataSource.Assert(aNode, aKey, aTarget, true);
		}
		catch(e) {
			return false;
		}
		this.flushDataSource(aDataSource);
		return true;
	},
 
	removeTargetFrom : function(aDataSource, aNode, aKey, aTarget) 
	{
		if (!aDataSource || !aNode || !aKey) return false;

		try {
			aNode   = this.getResource(aNode);
			aKey    = this.getResource(aKey);
			aTarget = aTarget !== void(0) ? this.getResource(aTarget) : this.getTarget(aDataSource, aNode, aKey) ;
			aDataSource.Unassert(aNode, aKey, aTarget);
		}
		catch(e) {
			return false;
		}
		this.flushDataSource(aDataSource);
		return true;
	},
 
	removeResourceFrom : function(aDataSource, aNode) 
	{
		if (!aDataSource || !aNode) return false;

		try {
			aNode = this.getResource(aNode);
			var keys = aDataSource.ArcLabelsOut(aNode),
				key,
				value;
			while (keys.hasMoreElements())
			{
				try {
					key   = keys.getNext().QueryInterface(Components.interfaces.nsIRDFResource);
					value = aDataSource.GetTarget(aNode, key, true);
					aDataSource.Unassert(aNode, key, value);
				}
				catch(e) {
				}
			}
		}
		catch(e) {
			return false;
		}
		this.flushDataSource(aDataSource);
		return true;
	},
  
	// Literal 
	
	getLiteralValueFrom : function(aDataSource, aNode, aKey) 
	{
		if (!aDataSource || !aNode || !aKey) return null;

		try {
			aNode = this.getResource(aNode);
			aKey  = this.getResource(aKey);
			var value = aDataSource.GetTarget(aNode, aKey, true);
			return value.QueryInterface(Components.interfaces.nsIRDFLiteral).Value;
		}
		catch(e) {
		}
		return null;
	},
 
	setLiteralValueTo : function(aDataSource, aNode, aKey, aValue) 
	{
		if (!aDataSource || !aNode || !aKey) return false;

		try {
			aNode = this.getResource(aNode);
			aKey  = this.getResource(aKey);
			var old   = aDataSource.GetTarget(aNode, aKey, true);
			var value = this.nsIRDFService.GetLiteral(String(aValue));
			if (old) {
				if (old.QueryInterface(Components.interfaces.nsIRDFLiteral).Value == value.Value)
					return true;
				else
					aDataSource.Change(aNode, aKey, old, value);
			}
			else
				aDataSource.Assert(aNode, aKey, value, true);
		}
		catch(e) {
			return false;
		}
		this.flushDataSource(aDataSource);
		return true;
	},
 
	addLiteralValueFor : function(aDataSource, aNode, aKey, aValue) 
	{
		if (!aDataSource || !aNode || !aKey) return false;

		try {
			aNode = this.getResource(aNode);
			aKey  = this.getResource(aKey);
			var value = this.nsIRDFService.GetLiteral(String(aValue));
			aDataSource.Assert(aNode, aKey, value, true);
		}
		catch(e) {
			return false;
		}
		this.flushDataSource(aDataSource);
		return true;
	},
 
	removeLiteralValueFrom : function(aDataSource, aNode, aKey) 
	{
		if (!aDataSource || !aNode || !aKey) return false;

		try {
			aNode = this.getResource(aNode);
			aKey  = this.getResource(aKey);
			var old = aDataSource.GetTarget(aNode, key, true);
			aDataSource.Unassert(aNode, aKey, old, true);
		}
		catch(e) {
			return false;
		}
		this.flushDataSource(aDataSource);
		return true;
	},
  
	// Container 
	
	get nsIRDFContainerUtils() 
	{
		if (!this._nsIRDFContainerUtils) {
			this._nsIRDFContainerUtils = Components.classes['@mozilla.org/rdf/container-utils;1'].getService(Components.interfaces.nsIRDFContainerUtils);
		}
		return this._nsIRDFContainerUtils;
	},
	_nsIRDFContainerUtils : null,

 
	getRDFSeqContainer : function(aDataSource, aRootNode) 
	{
		var container = Components.classes['@mozilla.org/rdf/container;1'].createInstance(Components.interfaces.nsIRDFContainer);
		var rootNode  = this.getResource(aRootNode);

		var type = this.getTarget(this.rootDataSource, rootNode, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type');
		if (
			!type ||
			!type.Value ||
			type.Value.toLowerCase().idnexOf('seq') < 0
			) {
			this.nsIRDFContainerUtils.MakeSeq(aDataSource, rootNode);
		}
		container.Init(aDataSource, rootNode);

		return container;
	},
 
	appendEntryTo : function(aContainer, aNode) 
	{
		aNode = this.getResource(aNode);
		if (aContainer.IndexOf(aNode) > -1) return;

		try {
			aContainer.AppendElement(aNode);
			this.flushDataSource(aContainer.DataSource);
		}
		catch(e) {
		}
	},
 
	removeEntryFrom : function(aContainer, aNode, aInfo) 
	{
		aNode = this.getResource(aNode);
		if (aContainer.IndexOf(aNode) < 0) return;

		try {
			while (aContainer.IndexOf(aNode) > -1)
			{
				aContainer.RemoveElement(aNode, true);
			}

			if (!aContainer.GetCount()) {
				WebMapService.removeResourceFrom(aContainer.DataSource, aContainer.Resource);
				WebMapService.flushDataSource(aContainer.DataSource);

				if (aInfo)
					aInfo.cleared = true;
			}

			this.flushDataSource(aContainer.DataSource);
		}
		catch(e) {
		}
	},
  
	getDataSourceForURI : function(aURIOrHost, aCreateAuto) 
	{
		if (!this.getPref('webmap.data.split')) {
			return this.rootDataSource;
		}

		if (!aURIOrHost) {
			return null;
		}
		else if (aURIOrHost.match(/^\w+:\/\//)) {
			var uri  = this.makeURIFromSpec(aURIOrHost);
			host = uri.host || 'unknown' ;
		}
		else {
			host = aURIOrHost;
		}

		var dataDir = this.getFileFromURLSpec(this.dataDirURI+'data/');
		if (!dataDir.exists()) {
			if (!aCreateAuto) return null;
			dataDir.create(dataDir.DIRECTORY_TYPE, 0755);
		}

		dataDir = this.getFileFromURLSpec(this.dataDirURI+'data/'+host+'/');
		if (!dataDir.exists()) {
			if (!aCreateAuto) return null;
			dataDir.create(dataDir.DIRECTORY_TYPE, 0755);
		}

		return this.getDataSourceForKey('data/'+host+'/'+host);
	},
	
	clearDataSourceForURI : function(aURI) 
	{
		if (!this.getPref('webmap.data.split')) return;

		var uri  = this.makeURIFromSpec(aURI);
		var host = uri.host || 'unknown' ;

		this.mCachedDataSources[host] = null;
		delete this.mCachedDataSources[host];

		var dataDir = this.getFileFromURLSpec(this.dataDirURI+'data/');
		if (!dataDir.exists()) return;

		dataDir = this.getFileFromURLSpec(this.dataDirURI+'data/'+host+'/');
		if (!dataDir.exists()) return;

		var dataURI  = this.dataDirURI+'data/'+host+'/'+host+'.rdf';
		var dataFile = this.getFileFromURLSpec(dataURI);
		if (dataFile.exists())
			dataFile.remove(true);

		dataDir.remove(true);
		return;
	},
 
	getDataSourceForKey : function(aKey) 
	{
		if (!(aKey in this.mCachedDataSources)) {
			var dataURI  = this.dataDirURI+aKey+'.rdf';
			var dataFile = this.getFileFromURLSpec(dataURI);
			if (!dataFile.exists())
				dataFile.create(dataFile.NORMAL_FILE_TYPE, 0644);

			if (!(aKey in this.mCachedDataSources))
				this.mCachedDataSources[aKey] = this.nsIRDFService.GetDataSource(dataURI);
		}
		return this.mCachedDataSources[aKey];
	},
  
	flushDataSource : function(aDataSource) 
	{
		try {
			aDataSource.QueryInterface(Components.interfaces.nsIRDFRemoteDataSource).Flush();
		}
		catch(e) {
		}
	},
 
	getTargetValue : function(aDataSource, aResource, aTarget) 
	{
		var img;
		aResource = this.getResource(aResource);
		aTarget   = this.getResource(aTarget);
		try {
			img = this.getTarget(aDataSource, aResource, aTarget);
			if (img)
				img = img.Value;
		}
		catch(e) {
		}
		if (!img)
			img = this.getLiteralValueFrom(aDataSource, aResource, aTarget);

		return img || null;
	},
  
	// operate nodes 
	
	updateNode : function(aInfo) 
	{
		const sv = WebMapService;

		var uri = sv.sanitizeURI(aInfo.URI);
		aInfo.URI = uri;
		if (!uri) return;

		var schemers = ['\n', sv.getPref('webmap.allow.schemer').split(/[\s,.\|]+/).join('\n'), '\n'].join('');
		if (schemers.indexOf('\n'+(uri || '').match(/^\w+/)+'\n') < 0)
			return;

		var ds  = sv.getDataSourceForURI(uri, true);
		var res = sv.nsIRDFService.GetResource(uri);

		var updated = [];
		var isLast;
		var count;

		var oldURL = sv.getLiteralValueFrom(ds, res, sv.kNC_URL);

		if (oldURL != uri) {
			sv.setLiteralValueTo(ds, res, sv.kNC_URL, uri);
			updated.push('uri');
		}

		// new entry
		if (!oldURL) {
			isLast = true;

			count = parseInt(sv.getLiteralValueFrom(sv.rootDataSource, sv.rootContainerNode, sv.NS+'EntriesCount') || 0);
			var max = sv.getPref('webmap.data.maxnodes');
			if (max && count >= max) {
				var first = sv.getTarget(sv.rootDataSource, sv.rootContainerNode, sv.NS+'FirstEntry');
				if (first.Value == res.Value) {
					first = sv.getTarget(ds, res, sv.NS+'LaterEntry');
				}
				sv.removeNode(first);
			}
			else
				sv.setLiteralValueTo(sv.rootDataSource, sv.rootContainerNode, sv.NS+'EntriesCount', count+1);
		}

		var title = aInfo.title;
		if (sv.getLiteralValueFrom(ds, res, sv.kNC_Name) != title) {
			sv.setLiteralValueTo(ds, res, sv.kNC_Name, title);
			updated.push('name');
		}

		sv.setLiteralValueTo(ds, res, sv.kWEB_LastVisitedDate, (new Date()).getTime());
		updated.push('lastVisited');

		var lastModified = aInfo.lastModified;
		if (lastModified &&
			sv.getLiteralValueFrom(ds, res, sv.kWEB_LastModifiedDate) != lastModified) {
			sv.setLiteralValueTo(ds, res, sv.kWEB_LastModifiedDate, lastModified);
			updated.push('lastModified');
		}


		var iconRes = ds.GetTarget(res, sv.nsIRDFService.GetResource(sv.NS+'AvailableIcon'), true);
		var img;
		if (iconRes) {
			img = sv.getTargetValue(ds, iconRes, sv.NS+'ImageData');
		}
		else {
			var icons = ds.GetTargets(res, sv.nsIRDFService.GetResource(sv.kNC_Icon), true);
			while (icons.hasMoreElements())
			{
				iconRes = icons.getNext().QueryInterface(Components.interfaces.nsIRDFResource);
				img = sv.getTargetValue(ds, iconRes, sv.NS+'ImageData');
				if (img) {
					if (img != 'data:') {
						sv.setTargetTo(ds, res, sv.NS+'AvailableIcon', iconRes);
					}
					break;
				}
			}
		}
		if (!img)
			sv.setFavIconFor(ds, uri);


		if (sv.getPref('webmap.image.type') == 2) {
			var tn_file_url = sv.getTargetValue(ds, res, sv.NS+'Thumbnail');
			if (!tn_file_url) {
				tn_file_url = ds.URI.replace(/[^\/]+$/, 'tn'+Math.floor(Math.random() * 1000000)+'.jpg')
			}
			if (sv.createThumbnailFor(uri, this.getFileFromURLSpec(tn_file_url).path))
				sv.setTargetTo(ds, res, sv.NS+'Thumbnail', tn_file_url);
		}


		if (aInfo.incrementCount) {
			count = parseInt(sv.getLiteralValueFrom(ds, res, sv.NS+'VisitedCount') || 0);
			sv.setLiteralValueTo(ds, res, sv.NS+'VisitedCount', count+1);
			updated.push('visitedCount');

			isLast = true;
		}

		if (isLast) this.setLastEntry(res);


		aInfo.fromURI   = aInfo.linkedURI;
		aInfo.targetURI = aInfo.URI;
		aInfo.isLink    = aInfo.linkedURI;
		sv.updateArc(aInfo);

		if (this.getPref('webmap.autolink.samedomain'))
			this.updateInternalArc(aInfo);


		// update root resource for this domain
		var host = (sv.makeURIFromSpec(uri).host || 'unknown');

		var rootRes = sv.nsIRDFService.GetResource(sv.NS+'urn:webmap:nodes:'+encodeURIComponent(host));
		var rootContainer = sv.getRDFSeqContainer(ds, rootRes);
		sv.appendEntryTo(rootContainer, res);

		sv.setLiteralValueTo(ds, rootRes, sv.NS+'Count', rootContainer.GetCount());



		if (!aInfo.linkedURI) {
			sv.addRootEntry(uri);
		}


		sv.notifyObservers(
			'webmap:service:node-operation',
			'update\n'+updated.join(',')+'\n'+
			uri+'\n'+(aInfo.linkedURI || '')
		);

		if (aInfo.isActive)
			sv.notifyObservers('webmap:service:node-operation', 'focus\nload\n'+uri);
	},
	
	setLastEntry : function(aNode) 
	{
		this.detachFromEntriesList(aNode);

		var ds   = this.getDataSourceForURI(aNode.Value);
		var last = this.getTarget(this.rootDataSource, this.rootContainerNode, this.NS+'LastEntry');
		if (last) {
			tmpDS = this.getDataSourceForURI(last.Value);
			this.setTargetTo(tmpDS, last,  this.NS+'LaterEntry', aNode);
			this.setTargetTo(ds,    aNode, this.NS+'OlderEntry', last);
		}
		else
			this.setTargetTo(this.rootDataSource, this.rootContainerNode, this.NS+'FirstEntry', aNode);

		this.setTargetTo(this.rootDataSource, this.rootContainerNode, this.NS+'LastEntry', aNode);
	},
 
	setFirstEntry : function(aNode) 
	{
		this.detachFromEntriesList(aNode);

		var ds    = this.getDataSourceForURI(aNode.Value);
		var first = this.getTarget(this.rootDataSource, this.rootContainerNode, this.NS+'FirstEntry');
		if (first) {
			var firstDS = this.getDataSourceForURI(first.Value);
			this.setTargetTo(firstDS, first, this.NS+'OlderEntry', aNode);
			this.setTargetTo(ds,      aNode, this.NS+'LaterEntry', first);
		}
		else
			this.setLastEntry(aNode);

		this.setTargetTo(this.rootDataSource, this.rootContainerNode, this.NS+'FirstEntry', aNode);
	},
 
	detachFromEntriesList : function(aNode) 
	{
		var ds = this.getDataSourceForURI(aNode.Value);
		var tmpDS;

		var older = this.getTarget(ds, aNode, this.NS+'OlderEntry');
		var later = this.getTarget(ds, aNode, this.NS+'LaterEntry');
		if (older) {
			tmpDS = this.getDataSourceForURI(older.Value);
			this.removeTargetFrom(tmpDS, older, this.NS+'LaterEntry');
			if (later)
				this.setTargetTo(tmpDS, older, this.NS+'LaterEntry', later);
			else
				this.setTargetTo(this.rootDataSource, this.rootContainerNode, this.NS+'LastEntry', older);

			this.removeTargetFrom(ds, aNode, this.NS+'OlderEntry');
		}
		if (later) {
			tmpDS = this.getDataSourceForURI(later.Value);
			this.removeTargetFrom(tmpDS, later, this.NS+'OlderEntry');
			if (older)
				this.setTargetTo(tmpDS, later, this.NS+'OlderEntry', older);
			else
				this.setTargetTo(this.rootDataSource, this.rootContainerNode, this.NS+'FirstEntry', later);

			this.removeTargetFrom(ds, aNode, this.NS+'LaterEntry');
		}

		var last = this.getTarget(this.rootDataSource, this.rootContainerNode, this.NS+'LastEntry');
		if (last && last.Value == aNode.Value)
			this.removeTargetFrom(this.rootDataSource, this.rootContainerNode, this.NS+'LastEntry');

		var first = this.getTarget(this.rootDataSource, this.rootContainerNode, this.NS+'FirstEntry');
		if (first && first.Value == aNode.Value)
			this.removeTargetFrom(this.rootDataSource, this.rootContainerNode, this.NS+'FirstEntry');
	},
  
	updateArc : function(aInfo) 
	{
		if (!aInfo.fromURI || !aInfo.targetURI) return;

		if (aInfo.isLink)
			this.updateLinkedArc(aInfo);
	},
	
	updateLinkedArc : function(aInfo) 
	{
		if (
			!aInfo.fromURI ||
			!aInfo.targetURI ||
			aInfo.fromURI == aInfo.targetURI
			)
			return;

		const sv = WebMapService;

		var targetURI = sv.sanitizeURI(aInfo.fromURI);
		var targetDS  = sv.getDataSourceForURI(targetURI, true);
		var fromURI   = sv.sanitizeURI(aInfo.targetURI);
		var fromDS    = sv.getDataSourceForURI(fromURI, true);

		if (fromURI == targetURI) return;

		window.setTimeout(function() {
			var targetNode = sv.nsIRDFService.GetResource(targetURI);
			var targetArcs = sv.nsIRDFService.GetResource(sv.NS+'urn:webmap:arcs:'+encodeURIComponent(targetURI));
			sv.setTargetTo(targetDS, targetNode, sv.NS+'Arcs', targetArcs);

			var fromNode   = sv.nsIRDFService.GetResource(fromURI);
			var fromArcs   = sv.nsIRDFService.GetResource(sv.NS+'urn:webmap:arcs:'+encodeURIComponent(fromURI));
			sv.setTargetTo(fromDS, fromNode, sv.NS+'Arcs', fromArcs);

			var arcRes = sv.nsIRDFService.GetResource(sv.NS+'urn:webmap:arc:'+encodeURIComponent(fromURI)+':'+encodeURIComponent(targetURI));
			sv.setTargetTo(fromDS, arcRes, sv.NS+'From', fromNode);
			sv.setTargetTo(fromDS, arcRes, sv.NS+'To',   targetNode);

			sv.setTargetTo(fromDS, arcRes, sv.NS+'ArcType', sv.NS+'Link');
			sv.setLiteralValueTo(fromDS, arcRes, sv.kWEB_LastVisitedDate, (new Date()).getTime());

			if (sv.makeURIFromSpec(fromURI).host != sv.makeURIFromSpec(targetURI).host) {
				sv.setLiteralValueTo(fromDS, arcRes, sv.NS+'ForeignDomain', 'true');
				sv.setLiteralValueTo(targetDS, arcRes, sv.NS+'ForeignDomain', 'true');
			}
			else {
				sv.setLiteralValueTo(fromDS, arcRes, sv.NS+'ForeignDomain', 'false');
				sv.setLiteralValueTo(targetDS, arcRes, sv.NS+'ForeignDomain', 'false');
			}

			if (aInfo.incrementCount) {
				var count = parseInt(sv.getLiteralValueFrom(fromDS, arcRes, sv.NS+'VisitedCount') || 0);
				sv.setLiteralValueTo(fromDS, arcRes, sv.NS+'VisitedCount', count+1);
			}

			sv.appendEntryTo(sv.getRDFSeqContainer(targetDS, targetArcs), arcRes);
			sv.appendEntryTo(sv.getRDFSeqContainer(fromDS, fromArcs), arcRes);

			sv.notifyObservers('webmap:arc-updated', fromURI+'\n'+targetURI);

			aInfo = null;
		}, 0);
	},
 
	updateInternalArc : function(aInfo) 
	{
		if (!aInfo.targetURI) return;

		const sv = WebMapService;

		var uri      = sv.sanitizeURI(aInfo.targetURI);
		var ds       = sv.getDataSourceForURI(uri, true);
		var host     = sv.makeURIFromSpec(uri).host || 'unknown';
		var fromNode = sv.nsIRDFService.GetResource(uri);
		var fromArcs = sv.nsIRDFService.GetResource(sv.NS+'urn:webmap:arcs:'+encodeURIComponent(uri));
		var fromArcsContainer = sv.getRDFSeqContainer(ds, fromArcs);

		sv.setTargetTo(ds, fromNode, sv.NS+'Arcs', fromArcs);

		window.setTimeout(function() {
			var container = sv.getRDFSeqContainer(ds, sv.NS+'urn:webmap:nodes:'+encodeURIComponent(host));

			var targetNodes = container.GetElements();
			var targetNode,
				targetArcs,
				arc;
			while (targetNodes.hasMoreElements())
			{
				targetNode = targetNodes.getNext().QueryInterface(Components.interfaces.nsIRDFResource);
				if (targetNode.Value == uri) continue;

				targetArcs = sv.nsIRDFService.GetResource(sv.NS+'urn:webmap:arcs:'+encodeURIComponent(targetNode.Value));

				sv.setTargetTo(ds, targetNode, sv.NS+'Arcs', targetArcs);

				arc = sv.nsIRDFService.GetResource(sv.NS+'urn:webmap:arc:'+encodeURIComponent(uri)+':'+encodeURIComponent(targetNode.Value));
				sv.setTargetTo(ds, arc, sv.NS+'From', fromNode);
				sv.setTargetTo(ds, arc, sv.NS+'To',   targetNode);

				sv.setTargetTo(ds, arc, sv.NS+'ArcType', sv.NS+'SameDomain');
				sv.setLiteralValueTo(ds, arc, sv.NS+'ForeignDomain', 'false');

				sv.appendEntryTo(fromArcsContainer, arc);
				sv.appendEntryTo(sv.getRDFSeqContainer(ds, targetArcs), arc);
			}
		}, 0);
	},
  
	removeNode : function(aRemoveNodeOrURIOrMessage) 
	{
		if (!aRemoveNodeOrURIOrMessage) return;

		var sv = this;

		var uri;
		var removeNode;

		if (
			typeof aRemoveNodeOrURIOrMessage == 'object' &&
			'URI' in aRemoveNodeOrURIOrMessage &&
			aRemoveNodeOrURIOrMessage.URI
			) {
			uri        = aRemoveNodeOrURIOrMessage.URI;
			removeNode = sv.getResource(uri);
		}
		else if (typeof aRemoveNodeOrURIOrMessage == 'string') {
			uri        = aRemoveNodeOrURIOrMessage;
			removeNode = sv.getResource(uri);
		}
		else {
			try {
				aRemoveNodeOrURIOrMessage = aRemoveNodeOrURIOrMessage.QueryInterface(Components.interfaces.nsIRDFResource);
			}
			catch(e) {
				return;
			}
			removeNode = aRemoveNodeOrURIOrMessage;
			uri        = removeNode.Value;
		}

if (sv.debug) dump('WebMapService::removeNode ('+uri+')\n');

		var ds = sv.getDataSourceForURI(uri);
		if (ds) {
			if (!sv.getLiteralValueFrom(ds, removeNode, sv.kNC_URL)) return;

			sv.detachFromEntriesList(removeNode);

			count = parseInt(sv.getLiteralValueFrom(sv.rootDataSource, sv.rootContainerNode, sv.NS+'EntriesCount') || 0);
			sv.setLiteralValueTo(sv.rootDataSource, sv.rootContainerNode, sv.NS+'EntriesCount', count-1);

			try {
				var arcsRes = sv.nsIRDFService.GetResource(sv.NS+'urn:webmap:arcs:'+encodeURIComponent(uri));
				var arcs = sv.getRDFSeqContainer(ds, arcsRes).GetElements();
				var arc;
				var node;
				var uris;
				if (arcs.hasMoreElements()) {
					var removeArcs = [];
					while (arcs.hasMoreElements())
					{
						arc = arcs.getNext().QueryInterface(Components.interfaces.nsIRDFResource);

						uris = arc.Value.replace(/[^#]+#urn:webmap:arc:/, '').split(':');
						uris[0] = decodeURIComponent(uris[0]);
						uris[1] = decodeURIComponent(uris[1]);

						if (uris[0] != uri &&
							sv.getLiteralValueFrom(sv.getDataSourceForURI(uris[0]), uris[0], sv.kNC_URL))
							sv.addRootEntry(uris[0]);

						if (uris[1] != uri &&
							sv.getLiteralValueFrom(sv.getDataSourceForURI(uris[1]), uris[1], sv.kNC_URL))
							sv.addRootEntry(uris[1]);

						removeArcs.push(arc);
					}
					for (var i in removeArcs)
						sv.removeArc(removeArcs[i]);
				}
				else {
					sv.removeResourceFrom(ds, arcsRes);
				}
			}
			catch(e) {
			}

			try {
				var icons = sv.getTargets(ds, removeNode, sv.kNC_Icon);
				var iconRes;
				while (icons.hasMoreElements())
				{
					iconRes = icons.getNext().QueryInterface(Components.interfaces.nsIRDFResource);

					var pageKey = sv.nsIRDFService.GetResource(sv.NS+'Page');
					sv.removeTargetFrom(ds, iconRes, pageKey, removeNode);

					if (!sv.getTarget(ds, iconRes, pageKey))
						sv.removeResourceFrom(ds, iconRes);

					sv.removeTargetFrom(ds, removeNode, sv.kNC_Icon, iconRes);
				}
			}
			catch(e) {
			}

			try {
				var tn = sv.getTargets(ds, removeNode, sv.NS+'Thumbnail');
				var tn_file = sv.getFileFromURLSpec(tn);
				if (tn_file.exists()) tn_file.remove(true);
				sv.removeTargetFrom(ds, removeNode,sv.NS+'Thumbnail', tn);
			}
			catch(e) {
			}


			// update root resource of this domain
			var host = (sv.makeURIFromSpec(uri).host || 'unknown');

			var rootRes = sv.nsIRDFService.GetResource(sv.NS+'urn:webmap:nodes:'+encodeURIComponent(host));
			var rootContainer = sv.getRDFSeqContainer(ds, rootRes);
			var info = { cleared : false }
			sv.removeEntryFrom(rootContainer, removeNode, info);

			sv.removeResourceFrom(ds, removeNode);

			if (info.cleared) {
				sv.removeResourceFrom(ds, rootRes);
				sv.clearDataSourceForURI(uri);
			}
			else {
				sv.setLiteralValueTo(ds, rootRes, sv.NS+'Count', rootContainer.GetCount());
			}
		}

		sv.removeRootEntry(uri);

		sv.notifyObservers('webmap:service:node-operation', 'remove\n'+uri);
	},
	
	removeArc : function(aRemoveArcOrIDOrMessage) 
	{
		if (!aRemoveArcOrIDOrMessage) return;

		var sv = this;
		var id;
		var fromURI;
		var targetURI;
		var res;

		if (
			typeof aRemoveArcOrIDOrMessage == 'object' &&
			'fromURI' in aRemoveArcOrIDOrMessage &&
			aRemoveArcOrIDOrMessage.fromURI &&
			'targetURI' in aRemoveArcOrIDOrMessage &&
			aRemoveArcOrIDOrMessage.targetURI
			) {
			fromURI   = aRemoveArcOrIDOrMessage.fromURI;
			targetURI = aRemoveArcOrIDOrMessage.targetURI;
			id        = encodeURIComponent(fromURI)+':'+encodeURIComponent(targetURI);
			res       = sv.getResource(sv.NS+'#urn:webmap:arc:/'+id);
		}
		else {
			if (typeof aRemoveArcOrIDOrMessage == 'string') {
				id  = aRemoveArcOrIDOrMessage;
				res = sv.getResource(sv.NS+'#urn:webmap:arc:/'+id);
			}
			else {
				try {
					aRemoveArcOrIDOrMessage = aRemoveArcOrIDOrMessage.QueryInterface(Components.interfaces.nsIRDFResource);
				}
				catch(e) {
					return;
				}
				res = aRemoveArcOrIDOrMessage;
				id  = res.Value.replace(/[^#]+#urn:webmap:arc:/, '');
			}
			var array     = id.split(':');
			fromURI   = decodeURIComponent(array[0]);
			targetURI = decodeURIComponent(array[1]);
		}
if (sv.debug) dump('WebMapService::removeArc\n   '+fromURI+'\n   '+targetURI+'\n');

		var fromDS    = sv.getDataSourceForURI(fromURI);
		var targetDS  = sv.getDataSourceForURI(targetURI);

		var fromArcs   = sv.nsIRDFService.GetResource(sv.NS+'urn:webmap:arcs:'+encodeURIComponent(fromURI));
		var fromContainer = sv.getRDFSeqContainer(fromDS, fromArcs);
		if (!fromContainer.GetCount())
			sv.removeResourceFrom(fromDS, fromArcs);
		else
			sv.removeEntryFrom(fromContainer, res);

		var targetArcs = sv.nsIRDFService.GetResource(sv.NS+'urn:webmap:arcs:'+encodeURIComponent(targetURI));
		var targetContainer = sv.getRDFSeqContainer(targetDS, targetArcs);
		if (!targetContainer.GetCount())
			sv.removeResourceFrom(targetDS, targetArcs);
		else
			sv.removeEntryFrom(targetContainer, res);

		sv.removeResourceFrom(fromDS,   res);
		sv.removeResourceFrom(targetDS, res);

		sv.notifyObservers('webmap:service:arc-operation', 'remove\n'+id);
	},
  
	setFavIconFor : function(aDataSource, aURI) 
	{
		var request  = new XMLHttpRequest();
		var listener = new WebMapFavIconLoader(aDataSource, aURI, request);
		request.onload = function() { listener.handleEvent(); };
		request.open('GET', aURI);
		request.send(null);
	},
  
	init : function() 
	{
		this.loadDefaultPrefs();

		if (
			this.activated ||
			!this.getPref('webmap.enabled') ||
			!this.browser
			)
			return;

		this.activated = true;


		var service;
		var host;
		var hosts = this.hostWindows;
		for (var i in hosts)
		{
			if (hosts[i] == window) continue;
			host = hosts[i];
			break;
		}

		if (host) service = host.WebMapService;
		if (!service)
			service = this;

		if (service.mCachedDataSources) {
			this.mCachedDataSources = service.mCachedDataSources;
		}
		else {
			this.mCachedDataSources = {};
			service.mCachedDataSources = this.mCachedDataSources;
		}


		var nullPointer;
		nullPointer = this.rootDataSource;
		nullPointer = this.rootContainer;

		if (!this.rootContainer.GetCount())
			this.removeResourceFrom(this.rootDataSource, this.rootContainer);

		nullPointer = this.rootContainer;

		window.addEventListener('unload', function() { WebMapService.destroy(); }, false);
	},
	
	loadDefaultPrefs : function() 
	{
		var uri = this.makeURIFromSpec('chrome://webmap/content/default.js');
		var content;
		try {
			var channel = this.nsIIOService.newChannelFromURI(uri);
			var stream  = channel.open();

			var scriptableStream = Components.classes['@mozilla.org/scriptableinputstream;1'].createInstance(Components.interfaces.nsIScriptableInputStream);
			scriptableStream.init(stream);

			content = scriptableStream.read(scriptableStream.available());

			scriptableStream.close();
			stream.close();
		}
		catch(e) {
		}

		if (!content) return;


		const DEFPrefs = Components.classes['@mozilla.org/preferences-service;1'].getService(Components.interfaces.nsIPrefService).getDefaultBranch(null);
		function pref(aPrefstring, aValue)
		{
			WebMapService.setPref(aPrefstring, aValue, DEFPrefs);
		}
		var user_pref = pref; // alias

		eval(content);
	},
  
	destroy : function() 
	{
		if (!this.activated) return;

		this.activated = false;
	},
 
	toString : function()
	{
		return '[object WebMapService]';
	}
}; 
 
function WebMapFavIconLoader(aDataSource, aPanelURI, aRequest) 
{
	this.mDataSource = aDataSource;
	this.mURI        = aPanelURI;
	this.mRequest    = aRequest;
}

WebMapFavIconLoader.prototype = {
	mDataSource : null,
	mURI        : null,
	mRequest    : null,
	mFavIconURI : null,
	
	handleEvent : function() 
	{
		if (
			!this.mRequest.responseText ||
			!this.mRequest.channel.contentType ||
			!this.mRequest.channel.contentType.match(/text\/(html|xml)|application\/(xml|[^\+]+\+xml)/i)
			)
			return;

		var favIconURI;

		var links = this.mRequest.responseText.match(/<([^:>]+:)?link\s([^>]*\s)?rel\s*=\s*("\s*(shortcut\s+)?icon\s*"|'\s*(shortcut\s+)?icon\s*'|\s*(shortcut\s+)?icon\s?)[^>]*>/ig);

		if (!links || !links.length) {
			if (WebMapService.getPref('webmap.favicon.load_root_favicon')) {
				var end = (this.mRequest.channel.URI.port == -1) ? '/favicon.ico' : (':' + this.mRequest.channel.URI.port + '/favicon.ico');
				favIconURI = this.mRequest.channel.URI.scheme + '://' + this.mRequest.channel.URI.host + end;

				this.mRequest.abort();
				this.loadFavIcon(favIconURI);
			}
			return;
		}

		for (var i = 0; i < links.length; i++)
		{
			favIconURI = this.getFavIconURIFromLink(links[i]);
			if (favIconURI)
				this.loadFavIcon(favIconURI);
		}

		this.mRequest.abort();
	},
 
	getFavIconURIFromLink : function(aLink) 
	{
		if (!aLink.match(/href\s*=\s*("[^"]+"|'[^']+')/i)) return null;

		var baseURI  = this.mRequest.channel.URI;
		var fragment = RegExp.$1.match(/^["'](.*)["']$/)[1];

		var base = this.mRequest.responseText.match(/<([^:>]+:)?base\s([^>]*\s)?href\s*=\s*("[^"]+"|'[^']+')[^>]*>/i);
		if (base && RegExp.$3) {
			base = RegExp.$3.match(/^["'](.*)["']$/)[1];
			if (base.match(/^\w+:\/\//))
				baseURI = WebMapService.nsIIOService.newURI(base, null, null);
			else
				baseURI = WebMapService.nsIIOService.newURI(baseURI.resolve(base), null, null);
		}

		uri = WebMapService.nsIIOService.newURI(baseURI.resolve(fragment), null, null).spec;

		try {
			if (!this.checkSecurity(uri)) return null;
		}
		catch(e) {
			return null;
		}

		return uri;
	},
 
	checkSecurity : function(aURI) 
	{
		const nsIContentPolicy = Components.interfaces.nsIContentPolicy;
		try {
			var contentPolicy = Components.classes['@mozilla.org/layout/content-policy;1'].getService(nsIContentPolicy);
		}
		catch(e) {
			return false; // Refuse to load if we can't do a security check.
		}


		// Verify that the load of this icon is legal.

		var uri     = WebMapService.nsIIOService.newURI(aURI, null, null);
		var origURI = WebMapService.nsIIOService.newURI(this.mRequest.channel.URI.spec, null, null);

		const secMan = Components.classes['@mozilla.org/scriptsecuritymanager;1'].getService(Components.interfaces.nsIScriptSecurityManager);
		const nsIScriptSecMan = Components.interfaces.nsIScriptSecurityManager;
		try {
			secMan.checkLoadURI(origURI, uri, nsIScriptSecMan.STANDARD);
		}
		catch(e) {
			return false;
		}

/*
		if (contentPolicy.shouldLoad(
				nsIContentPolicy.TYPE_IMAGE,
				uri,
				origURI,
				aEvent.target,
				safeGetProperty(aEvent.target, 'type'),
				null
			) != nsIContentPolicy.ACCEPT)
			return false;
*/

		return true;
	},
 
	loadFavIcon : function(aFavIconURI) 
	{
		this.mFavIconURI = aFavIconURI;

		const sv = WebMapService;

		var iconRes = sv.nsIRDFService.GetResource(this.mFavIconURI);
		var pageRes = sv.nsIRDFService.GetResource(this.mURI);
		sv.addTargetTo(this.mDataSource, pageRes, sv.kNC_Icon, iconRes);
		sv.addTargetTo(this.mDataSource, iconRes, sv.NS+'Page', pageRes);


		if (!sv.getPref('webmap.favicon.cache.enabled') ||
			sv.getTargetValue(this.mDataSource, iconRes, sv.NS+'ImageData')) return;

		var loader = new pImageLoader(this.mFavIconURI, this);
		loader.load();
	},
 
	onImageLoad : function(aImageData) 
	{
		var sv      = WebMapService;
		var iconRes = sv.nsIRDFService.GetResource(this.mFavIconURI);
		var img     = sv.getTargetValue(this.mDataSource, iconRes, sv.NS+'ImageData');
		if (!aImageData && img)
			return;

		if (sv.getPref('webmap.favicon.cache.file')) {
			var host     = sv.makeURIFromSpec(this.mURI).host;
			var dataDir  = sv.dataDirURI+'data/'+host+'/';
			var fileName = this.mFavIconURI.match(/[^\/]+$/);
			var iconFile = sv.getFileFromURLSpec(dataDir+fileName);
			if (!iconFile.exists()) {
				var iconURI = sv.makeURIFromSpec(this.mFavIconURI);
				var PERSIST = Components.classes['@mozilla.org/embedding/browser/nsWebBrowserPersist;1'].createInstance(Components.interfaces.nsIWebBrowserPersist);
				if (PERSIST.saveURI.arity == 3) // old implementation
					PERSIST.saveURI(iconURI, null, iconFile);
				else
					PERSIST.saveURI(iconURI, null, null, null, null, iconFile);
			}
			sv.setTargetTo(this.mDataSource, iconRes, sv.NS+'ImageData', dataDir+fileName);

			sv.notifyObservers(
				'webmap:service:node-operation',
				'update\nimage\n'+this.mURI
			);

			return;
		}

		sv.setLiteralValueTo(this.mDataSource, iconRes, sv.NS+'ImageData', aImageData);
	},
 
	onImageError : function(aStatusCode) 
	{
		var sv      = WebMapService;
		var iconRes = sv.nsIRDFService.GetResource(this.mFavIconURI);
		if (sv.getLiteralValueFrom(this.mDataSource, iconRes, sv.NS+'ImageData'))
			return;

		sv.setLiteralValueTo(this.mDataSource, iconRes, sv.NS+'ImageData', 'data:');
	},
 
	toString : function()
	{
		return '[object WebMapFavIconLoader]';
	}
}; 
   
// end of definition 
window.addEventListener('load', function() { WebMapService.init(); }, false);
window.addEventListener('load', function() { WebMapService.init(); }, false);
}
 
