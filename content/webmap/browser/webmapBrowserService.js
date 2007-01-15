// start of definition 
if (!window.WebMapBrowserService) {

var WebMapBrowserService = {
	activated : false,
	lastState : window.windowState,
	
	// references 
	
	get service() 
	{
		return WebMapService;
	},
 
	get browser() 
	{
		return document.getElementById('content');
	},
 
	get webMapView() 
	{
		return this.service.getTopWindowOf('webmap:view');
	},
  
	updateGoMenu : function() 
	{
		if (document.getElementById('goPopup')) return;

		var toHistoryItem = document.getElementsByAttribute('oncommand', 'toHistory()');
		if (!toHistoryItem.length) return;

		for (var i = 0; i < toHistoryItem.length; i++)
		{
			if (!toHistoryItem[i].parentNode.parentNode.parentNode.id == 'main-menubar')
				continue;

			var item = document.createElement('menuitem');
			item.setAttribute('id',          'toggleWebMapView-menuitem');
			item.setAttribute('broadcaster', 'toggleWebMapView-broadcaster');
			item.setAttribute('key',         'key_toggleWebMapView');
			item.setAttribute('command',     'cmd_toggleWebMapView');

			if (toHistoryItem[i].nextSibling)
				toHistoryItem[i].parentNode.insertBefore(item, toHistoryItem[i]);
			else
				toHistoryItem[i].parentNode.appendChild(item);

			return;
		}
	},
 
	onPageLoad : function(aEvent) 
	{
		const sv  = WebMapService;
		const bsv = WebMapBrowserService;
		if (!sv) return;

		var doc = aEvent.originalTarget;
		if ('document' in doc) doc = sv.lookupMethod(doc, 'document');

		var uri = sv.lookupMethod(doc, 'URL');
		if (uri == 'about:blank') return;

		uri = sv.sanitizeURI(uri);

		var datasource   = sv.getDataSourceForURI(uri);
		var lastModified = new Date(sv.lookupMethod(doc, 'lastModified'));
		var isActive     = sv.getDocShellFromDocument(doc, bsv.browser.docShell) ? true : false ;

		window.setTimeout(sv.updateNode, 0, {
			URI            : uri,
			linkedURI      : sv.lookupMethod(doc, 'referrer')
			title          : sv.lookupMethod(doc, 'title'),
			lastModified   : (lastModified.valueOf() ? lastModified.getTime() : 0 ),
			isActive       : isActive,
			incrementCount : true
		});
	},
 
	onTabSelect : function(aEvent) 
	{
		if (aEvent.originalTarget.localName != 'tabpanels') return;

		WebMapService.notifyObservers(
			'webmap:service:node-operation',
			'focus\ntab\n'+WebMapBrowserService.browser.currentURI.spec
		);
	},
 
	onWindowFocus : function(aEvent) 
	{
		if (aEvent.target != window) return;

		WebMapService.notifyObservers(
			'webmap:service:node-operation',
			'focus\nwindow\n'+WebMapBrowserService.browser.currentURI.spec
		);
	},
 
	handleFocus : function(aEvent) 
	{
		WebMapService.notifyObservers('webmap:browser-operation', 'focus');
	},
 
	createTabProgressListener : function(aTabBrowser, aTab) 
	{
		return ({
			mTab        : aTab,
			mTabBrowser : aTabBrowser,

			onStateChange : function(aWebProgress, aRequest, aStateFlags, aStatus)
			{
				try {
					const PL = Components.interfaces.nsIWebProgressListener;
					const sv = WebMapService;
					if (
						!aWebProgress ||
						!aWebProgress.DOMWindow ||
						!aStateFlags ||
						!(aStateFlags & PL.STATE_IS_NETWORK)
						)
						return;

					var w = aWebProgress.DOMWindow;
					if (
						!w ||
						!(aStateFlags & PL.STATE_STOP) ||
						w.location.href == 'about:blank'
						)
						return;

					WebMapBrowserService.updateNodesForFrames([w], (this.mTab == this.mTabBrowser.selectedTab));

				}
				catch(e) {
//					dump(e+'\n');
				}
			},

			onProgressChange : function(aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress) {},
			onLocationChange : function(aWebProgress, aRequest, aLocation) {},
			onStatusChange : function(aWebProgress, aRequest, aStatus, aMessage) {},
			onSecurityChange : function(aWebProgress, aRequest, aState) {},
			onLinkIconAvailable : function(aHref) {},

			QueryInterface : function(aIID)
			{
				if (aIID.equals(Components.interfaces.nsIWebProgressListener) ||
					aIID.equals(Components.interfaces.nsISupportsWeakReference) ||
					aIID.equals(Components.interfaces.nsISupports))
					return this;
				throw Components.results.NS_NOINTERFACE;
			}
		});
	},
	updateNodesForFrames : function(aFrames, aIsActive)
	{
		const sv = WebMapService;
		var uri;
		var datasource;
		var lastModified;

		for (var i = 0; i < aFrames.length; i++)
		{
			uri = sv.sanitizeURI(aFrames[i].location.href);
			datasource = sv.getDataSourceForURI(uri);
			lastModified = new Date(aFrames[i].document.lastModified);
			sv.updateNode({
				URI            : uri,
				linkedURI      : aFrames[i].document.referrer,
				title          : aFrames[i].document.title,
				lastModified   : (lastModified.valueOf() ? lastModified.getTime() : 0 ),
				isActive       : (aIsActive || document.commandDispatcher.focusedWindow == aFrames[i]),
				incrementCount : true
			});

			try {
				frames = sv.lookupMethod(aFrames[i], 'frames');
				if (frames)
					WebMapBrowserService.updateNodesForFrames(frames);
			}
			catch(e) {
			}
		}
	},
	
	addTab : function(aURI, aReferrerURI, aInfo) 
	{
		var tab = this.__webmapBrowserService__addTab(aURI, aReferrerURI, aInfo);
		WebMapBrowserService.addTabProgressListenerTo(this, tab);
		return tab;
	},
	
	addTabProgressListenerTo : function(aTabBrowser, aTab) 
	{
		var b   = aTabBrowser.getBrowserForTab(aTab);
		if ('mWebMapBrowserServiceFilter' in b ||
			'mWebMapBrowserServiceListener' in b) return;

		var listener = this.createTabProgressListener(aTabBrowser, aTab);

		try {
			if ('@mozilla.org/appshell/component/browser-status-filter;1' in Components.classes) {
				const filter = Components.classes['@mozilla.org/appshell/component/browser-status-filter;1'].createInstance(Components.interfaces.nsIWebProgress);

				filter.addProgressListener(listener, Components.interfaces.nsIWebProgress.NOTIFY_ALL);
				b.webProgress.addProgressListener(filter, Components.interfaces.nsIWebProgress.NOTIFY_ALL);
				b.mWebMapBrowserServiceFilter = filter;
			}
			else // for Mozilla 1.0.x
				b.webProgress.addProgressListener(listener, Components.interfaces.nsIWebProgress.NOTIFY_ALL);
		}
		catch(e) {
		}

		b.mWebMapBrowserServiceListener = listener;
	},
  
	removeTab : function(aTab, aFlags) 
	{
		if (this.mTabContainer.childNodes.length > 1)
			WebMapBrowserService.removeTabProgressListenerFrom(this, aTab);

		this.__webmapBrowserService__removeTab(aTab, aFlags);
		return;
	},
	
	removeTabProgressListenerFrom : function(aTabBrowser, aTab) 
	{
		var b = aTabBrowser.getBrowserForTab(aTab);
		try {
			if (b.mWebMapBrowserServiceFilter) {
				if (b.mWebMapBrowserServiceListener)
					b.mWebMapBrowserServiceFilter.removeProgressListener(b.mWebMapBrowserServiceListener);
				b.webProgress.removeProgressListener(b.mWebMapBrowserServiceFilter);
			}
			else if (b.mWebMapBrowserServiceListener)
				b.webProgress.removeProgressListener(b.mWebMapBrowserServiceListener);
		}
		catch(e) {
		}
	},
   
	contentAreaClick : function(aEvent, aFieldNormalClicks) 
	{
		var uri = WebMapBrowserService.getLinkURIFromEvent(aEvent);
		if (
			uri &&
			(
				aEvent.type == 'keypress' ||
				(
					(aEvent.button == 0) ? true :
					(aEvent.button == 1) ? WebMapService.getPref('browser.tabs.opentabfor.middleclick') :
					false
				)
			)
			) {
			var node = aEvent.target;
			try{
			WebMapService.updateNode({
				URI       : uri,
				linkedURI : WebMapBrowserService.lookupMethod(node.ownerDocument, 'URL');,
				title     : node.textContent+(node.title ? ' ('+node.title+')' : '' )
			});
			}catch(e){alert(e);}
		}
		return __webmapBrowserService__contentAreaClick(aEvent, aFieldNormalClicks);
	},
	
	getLinkURIFromEvent : function(aEvent) 
	{
		var target = aEvent.target;
		var linkNode;
		switch (target.localName.toLowerCase()) {
			case 'a':
			case 'area':
			case 'link':
				if (target.hasAttribute('href'))
					linkNode = target;
				break;
			default:
				var node = aEvent.originalTarget;
				while (node.localName != 'a' && node.parentNode)
					node = node.parentNode;
				if (node.localName == 'a' && node.hasAttribute('href'))
					linkNode = node;
				break;
		}
		var href;
		if (linkNode) {
			href = linkNode.href;
		}
		else {
			while (linkNode)
			{
				if (linkNode.nodeType == Node.ELEMENT_NODE) {
					href = linkNode.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
					break;
				}
				linkNode = linkNode.parentNode;
			}
			if (href) {
				var ioService = Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService);
				var baseURI = ioService.newURI(linkNode.baseURI, null, null);
				href = ioService.newURI(baseURI.resolve(href), null, null).spec;
			}
		}
		return href;
	},
  
	showHideWebMapView : function() 
	{
		if (this.webMapView) {
			this.webMapView.close();
			this.service.notifyObservers('webmap:view:window', 'close');
		}
		else {
			var filename = this.service.isNewTypeBrowser ? 'webmapView.xul' : 'webmapViewOldType.xul' ;
			window.openDialog(
				'chrome://webmap/content/view/'+filename, '_blank',
				'chrome,extrachrome,all,dialog=no' + (this.service.getPref('webmap.view.alwaysRaised') ? ',alwaysRaised' : '')
			);
			this.service.notifyObservers('webmap:view:window', 'open');
		}
	},
 
	// nsIObserver 
	observe : function(aSubject, aTopic, aData)
	{
		var broadcaster = document.getElementById('toggleWebMapView-broadcaster');
		if (!broadcaster) return;

		aData = (String(aData) || '').split('\n');
		switch (aTopic)
		{
			case 'webmap:view:window':
				switch (aData[0])
				{
					case 'open':
						broadcaster.setAttribute('checked', true);
						WebMapViewWindowStateWatcher.start();
						this.service.setPref('webmap.view.sync_open_state.shouldShow', false);
						break;
					case 'close':
						broadcaster.removeAttribute('checked');
						WebMapViewWindowStateWatcher.stop();
						break;
					default:
						break;
				}
				break;

			case 'webmap:view:state':
				if (aData[0] == 'always-raised' && this.webMapView) {
					this.showHideWebMapView();
					window.setTimeout('WebMapBrowserService.showHideWebMapView();', 100);
				}
				break;

			default:
				break;
		}
	},
 
	init : function() 
	{
		if (
			this.activated ||
			!this.service.getPref('webmap.enabled') ||
			!this.browser
			)
			return;

		this.activated = true;

		if (!this.service.isNewTypeBrowser) {
			this.updateGoMenu();
		}

		this.service.nsIObserverService.addObserver(this, 'webmap:view:window', false);
		this.service.nsIObserverService.addObserver(this, 'webmap:view:state', false);

		WebMapViewWindowStateWatcher.init();

//		window.addEventListener('select', this.onWindowFocus, false);

		window.addEventListener('click',   this.handleFocus, true);
		window.addEventListener('keydown', this.handleFocus, true);
		window.addEventListener('focus',   this.handleFocus, true);


		var b = this.browser;

		b.addEventListener('select', this.onTabSelect, false);
//		b.addEventListener('load', this.onPageLoad, true);

		b.__webmapBrowserService__addTab = b.addTab;
		b.addTab = this.addTab;
		b.__webmapBrowserService__removeTab = b.removeTab;
		b.removeTab = this.removeTab;

		this.addTabProgressListenerTo(b, b.selectedTab);

		b = null;


		window.setTimeout(function() {
			if ('contentAreaClick' in window) {
				window.__webmapBrowserService__contentAreaClick = window.contentAreaClick;
				window.contentAreaClick = WebMapBrowserService.contentAreaClick;
			}
		}, 10);



		// when only this window is the first browser
		if (this.service.getPref('webmap.view.sync_open_state.shouldShow') &&
			this.service.browserWindows.length == 1) {
			if (!this.webMapView) this.showHideWebMapView();
		}


		window.addEventListener('unload', function() { WebMapBrowserService.destroy(); }, false);
	},
 
	destroy : function() 
	{
		if (!this.activated) return;

		this.activated = false;


		var b = this.service.browserWindows;
		if (
			this.service.getPref('webmap.view.sync_open_state.enabled') &&
			this.webMapView &&
			(
				!b.length ||
				(b.length == 1 && b[0] == window)
			)
			) {
			this.service.setPref('webmap.view.sync_open_state.shouldShow', true);
			this.webMapView.close();
		}


		this.service.nsIObserverService.removeObserver(this, 'webmap:view:window');
		this.service.nsIObserverService.removeObserver(this, 'webmap:view:state');

		WebMapViewWindowStateWatcher.destroy();

//		window.removeEventListener('select', this.onWindowFocus, false);

		window.removeEventListener('click',   this.handleFocus, true);
		window.removeEventListener('keydown', this.handleFocus, true);
		window.removeEventListener('focus',   this.handleFocus, true);


		this.browser.removeEventListener('select', this.onTabSelect, false);
//		this.browser.removeEventListener('load', this.onPageLoad, true);
	},
 
	toString : function()
	{
		return '[object WebMapBrowserService]';
	}
}; 
 
var WebMapViewWindowStateWatcher = 
{
	domain  : 'webmap.view.sync_minimize_state.enabled',
	timer   : null,

	defaultInterval : 200,
	
	get enabled() 
	{
		return WebMapService.getPref(this.domain);
	},
 
	observe : function(aSubject, aTopic, aPrefName) 
	{
		if (aTopic != 'nsPref:changed') return;

		var view   = WebMapBrowserService.webMapView;
		var active = this.enabled;
		if (!active || !view) {
			this.stop();
		}
		else if (active && view) {
			this.start();
		}
	},
 
	checkWindowState : function() 
	{
		var view = WebMapBrowserService.webMapView;

		if (!view) {
			WebMapViewWindowStateWatcher.stop();
			return;
		}

		if (window.windowState == window.STATE_MINIMIZED) {
			if (WebMapBrowserService.lastState == window.STATE_NORMAL) {
				WebMapBrowserService.lastState = window.STATE_MINIMIZED;
				if (view.windowState != view.STATE_MINIMIZED)
					view.WebMapCommand.minimize();
			}
		}
		else {
			if (WebMapBrowserService.lastState == window.STATE_MINIMIZED) {
				WebMapBrowserService.lastState = window.STATE_NORMAL;
				if (view.windowState == view.STATE_MINIMIZED)
					view.WebMapCommand.restore();
			}
		}
	},
 
	start : function() 
	{
		if (!this.timer)
			this.timer = window.setInterval(
				this.checkWindowState,
				Math.max(WebMapService.getPref('webmap.view.sync_minimize_state.interval'), 0) || this.defaultInterval
			);
	},
 
	stop : function() 
	{
		if (this.timer) {
			window.clearInterval(this.timer);
			this.timer = null;
		}
	},
 
	init : function() 
	{
		try {
			var pbi = WebMapService.Prefs.QueryInterface(Components.interfaces.nsIPrefBranchInternal);
			pbi.addObserver(this.domain, this, false);

			this.observe(null, 'nsPref:changed', null);
		}
		catch(e) {
		}
	},
 
	destroy : function() 
	{
		this.stop();
		try {
			var pbi = WebMapService.Prefs.QueryInterface(Components.interfaces.nsIPrefBranchInternal);
			pbi.removeObserver(this.domain, this, false);
		}
		catch(e) {
		}
	},
 
}; 
   
// end of definition 
window.addEventListener('load', function() { WebMapBrowserService.init(); }, false);
window.addEventListener('load', function() { WebMapBrowserService.init(); }, false);
}
 
