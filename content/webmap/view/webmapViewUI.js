var WebMapViewUI = { 
	activated : false,
	
	// statusbar 
	
	showStatus : function(aStatus) 
	{
		if (aStatus.timer) {
			window.clearTimeout(aStatus.timer);
			aStatus.timer = null;
		}

		aStatus.removeAttribute('collapsed');

		aStatus.timer = window.setTimeout(
			this.showStatusCallback,
			WebMapService.getPref('webmap.status.delay.hide'),
			aStatus
		);
	},
	showStatusCallback : function(aStatus) {
		aStatus.setAttribute('collapsed', true);
	},
	
	get statusPan() 
	{
		if (!this._statusPan) {
			this._statusPan =   document.getElementById('status-pan');
			this._statusPan.x = document.getElementById('status-pan-x');
			this._statusPan.y = document.getElementById('status-pan-y');
		}
		return this._statusPan;
	},
	_statusPan : null,
 
	get statusMove() 
	{
		if (!this._statusMove) {
			this._statusMove   = document.getElementById('status-move');
			this._statusMove.x = document.getElementById('status-move-x');
			this._statusMove.y = document.getElementById('status-move-y');
		}
		return this._statusMove;
	},
	_statusMove : null,
  
	get statusMessage() 
	{
		if (!this._statusMessage)
			this._statusMessage = document.getElementById('status-message');

		return this._statusMessage;
	},
	_statusMessage : null,
	
	setMessage : function(aMessage) 
	{
		this.statusMessage.label = aMessage;
	},
   
	// toolbar item 
	
	get toolbarZoomItem() 
	{
		var toolbarZoomItem = document.getElementById('webmap-toolbar-zoom');
		if (toolbarZoomItem && !toolbarZoomItem.valueNode) {
			toolbarZoomItem.valueNode = document.getElementById('webmap-toolbar-zoom-value');

			var popup = toolbarZoomItem.valueNode.firstChild;
			var range = document.createRange();
			range.selectNodeContents(popup);
			range.deleteContents();
			range.detach();

			var preset = WebMapService.getPref('webmap.world.scale.preset').split(',');
			for (var i in preset)
				toolbarZoomItem.valueNode.appendItem(preset[i], preset[i]);

			toolbarZoomItem.valueNode.value = WebMapService.getPref('webmap.world.scale');
		}
		return toolbarZoomItem;
	},
	
	onChangeZoom : function() 
	{
		var scale = Number(this.toolbarZoomItem.valueNode.value);
		if (isNaN(scale))
			this.toolbarZoomItem.valueNode.value = WebMapView.world.scale;
		else
			WebMapView.zoom(scale);
	},
  
	get toolbarMapModeItem() 
	{
		var toolbarMapModeItem = document.getElementById('webmap-toolbar-mapmode');
		if (toolbarMapModeItem) {
			toolbarMapModeItem.setAttribute('checked', WebMapService.getPref('webmap.world.mode') == 'all');
		}
		return toolbarMapModeItem;
	},
 
	get toolbarCollapseItem() 
	{
		var toolbarCollapseItem = document.getElementById('webmap-toolbar-collapse');
		if (toolbarCollapseItem) {
			toolbarCollapseItem.setAttribute('checked', this.contentOuterBox.collapsed);
		}
		return toolbarCollapseItem;
	},
 
	get throbber() 
	{
		var throbber = document.getElementById('webmap-throbber');
		if (throbber) {
			if (this.isBusy)
				throbber.setAttribute('busy', true);
			else
				throbber.removeAttribute('busy');
		}
		return throbber;
	},
	
	get isBusy() 
	{
		return this._isBusy;
	},
	set isBusy(val)
	{
		this._isBusy = val;

		var throbber = this.throbber;
		if (throbber) {
			if (val)
				throbber.setAttribute('busy', true);
			else
				throbber.removeAttribute('busy');
		}
		return val;
	},
	_isBusy : false,
   
	// context menu 
	
	initContextMenu : function(aEvent) 
	{
		if (aEvent.target.id != 'webmap-contextmenu') return;

		if (WebMapView.isBuilding) {
			aEvent.preventDefault();
			aEvent.stopPropagation();
			return false;
		}

		this.menuShown = true;

		var popup  = aEvent.target;
		var node   = WebMapView.viewDocument.popupNode;
		node = WebMapCommand.getRealTarget(node);

		var nav            = WebMapService.browserWindow;
		var onNode         = WebMapCommand.isWebMapNode(node);
		var onArc          = WebMapCommand.isWebMapArc(node);
		var onCanvas       = !onNode && !onArc;
		var selectionNodes = WebMapView.getSelectedNodes();

		var multiple       = (selectionNodes && selectionNodes.length > 1);
		var multipleDomain = multiple && selectionNodes[0].type == 'domain-node';
		var hasNodes       = WebMapView.hasNodes();

		if (onNode)
			WebMapCommand.contextNode = node;
		if (onArc)
			WebMapCommand.contextArc = node;

		var onDomainNode = onNode && node.type == 'domain-node';
		var onPageNode   = onNode && !onDomainNode;

		if (node && !WebMapCommand.isActive(node)) {
			onNode       = false;
			onArc        = false;
			onDomainNode = false;
			onPageNode   = false;
			onCanvas     = true;
			WebMapCommand.contextNode = null;
			WebMapCommand.contextArc = null;
		}

		this.showHideItem('webmap-context-item-load',         onPageNode && !multiple);
		this.showHideItem('webmap-context-item-loadInTab',    onPageNode && nav && !multiple);
		this.showHideItem('webmap-context-item-loadDomainInTab', onDomainNode && nav && !multiple);
		this.showHideItem('webmap-context-item-loadAllInTab', !onArc && nav && multiple && !multipleDomain);
		this.showHideItem('webmap-context-item-loadAllDomainInTab', !onArc && nav && multipleDomain);
		this.showHideItem('webmap-context-item-openWindow',   onPageNode && nav && !multiple);

		this.showHideItem('webmap-context-item-gotoFromNode',   onArc);
		this.showHideItem('webmap-context-item-gotoTargetNode', onArc);
		if (onArc) this.initArcPopup(popup, node);

		this.showHideItem('webmap-context-item-selectNeighbor',   onNode && !multiple);
		this.showHideItem('webmap-context-item-selectSameDomain', onPageNode && !multiple);
		this.showHideItem('webmap-context-item-selectAll',        onCanvas && hasNodes && !selectionNodes.length);

		this.showHideItem('webmap-context-item-removeNode',      onPageNode && !multiple);
		this.showHideItem('webmap-context-item-removeDomain',      onDomainNode && !multiple);
		this.showHideItem('webmap-context-item-removeArc',       onArc && WebMapCommand.contextArc.fromNode.type != 'domain-node');
		this.showHideItem('webmap-context-item-removeSelection', !onArc && multiple && !multipleDomain);
		this.showHideItem('webmap-context-item-removeDomainSelection', !onArc && multipleDomain);

		this.showHideItem('webmap-context-item-zoomIn',      onCanvas && !multiple);
		this.showHideItem('webmap-context-item-zoomOut',     onCanvas && !multiple);
		this.showHideItem('webmap-context-item-startScroll', onCanvas && !multiple);

		this.showHideItem('webmap-context-item-nodes', hasNodes && !multiple && !onArc);

		this.showHideMenuSeparator(popup);
	},
	
	showHideItem : function(aID, aShow) 
	{
		var node = document.getElementById(aID);
		if (aShow)
			node.removeAttribute('hidden');
		else
			node.setAttribute('hidden', true);
	},
 
	showHideMenuSeparator : function(aPopup) 
	{
		var nodes       = aPopup.childNodes;
		var lastVisible = null;

		for (var i = 0; i < nodes.length; i++)
		{
			if (
				nodes[i].localName == 'menuseparator' &&
				(!lastVisible || lastVisible.localName == 'menuseparator')
				)
				nodes[i].setAttribute('hidden', true);
			else if (nodes[i].localName == 'menuseparator')
				nodes[i].removeAttribute('hidden');

			if (nodes[i].getAttribute('hidden') != 'true')
				lastVisible = nodes[i];
		}

		if (lastVisible && lastVisible.localName == 'menuseparator')
			lastVisible.setAttribute('hidden', true);
	},
 
	initArcPopup : function(aPopup, aNode) 
	{
		var item;
		item = aPopup.getElementsByAttribute('item-gotoFromNode', 'true')[0];
		item.setAttribute('label', item.getAttribute('labelmodifier').replace(/%s/i, aNode.fromNode.label));
		item.setAttribute('image', aNode.fromNode.image);
		item = aPopup.getElementsByAttribute('item-gotoTargetNode', 'true')[0];
		item.setAttribute('label', item.getAttribute('labelmodifier').replace(/%s/i, aNode.targetNode.label));
		item.setAttribute('image', aNode.targetNode.image);
	},
  
	destroyContextMenu : function(aEvent) 
	{
		if (aEvent.target.id != 'webmap-contextmenu') return;

		this.menuShown = false;
		WebMapCommand.contextNode = null;
		WebMapCommand.contextArc  = null;
	},
 
	initNodesPopup : function(aEvent) 
	{
		var popup = aEvent.target;
		var range = document.createRange();
		range.selectNodeContents(popup);
		range.deleteContents();
		range.detach();


		var selectionNode = WebMapView.getSelectedNodes();
		selectionNode = selectionNode.length == 1 ? selectionNode[0] : null ;

		var node = popup.parentNode;
		if (
			node.id != 'webmap-context-item-nodes' ||
			WebMapCommand.contextNode ||
			selectionNode
			) {
			if (node.id == 'webmap-context-item-nodes')
				node = WebMapCommand.contextNode || selectionNode;
			else
				node = node.targetNode;

			popup.appendChild(document.createElement('menuitem'));
			popup.firstChild.setAttribute('label', document.getElementById('webmap-context-item-nodes').getAttribute('select-item-label'));
			popup.firstChild.setAttribute('target-node-id', node.id);

			var target;
			for (var i in node.arcs)
			{
				if (!node.arcs[i]) continue;
				target = (node.arcs[i].fromNode != node) ? node.arcs[i].fromNode :
						(node.arcs[i].targetNode != node) ? node.arcs[i].targetNode :
						null ;
				if (target)
					popup.appendChild(this.createNodeMenuItem(target));
			}

			if (popup.childNodes.length > 1)
				popup.insertBefore(
					document.createElement('menuseparator'),
					popup.childNodes[1]
				);
		}
		else { // root container
			var rootNodes = WebMapService.rootContainer.GetElements();
			while (rootNodes.hasMoreElements())
				popup.appendChild(
					this.createNodeMenuItem(
						WebMapView.getNode(
							rootNodes.getNext().QueryInterface(Components.interfaces.nsIRDFResource).Value
						)
					)
				);
		}
	},
	
	createNodeMenuItem : function(aNode) 
	{
		if (!aNode) return null;

		var node = document.createElement('menu');
		node.setAttribute('label', aNode.label);
		node.setAttribute('style', 'max-width: '+Math.max(WebMapService.getPref('webmap.contextmenu.node_menu.width'), 0)+'em;');
		node.appendChild(document.createElement('menupopup'));

		node.targetNode = aNode;

		return node;
	},
  
	destroyNodesPopup : function(aEvent) 
	{
		var popup = aEvent.target;
		var range = document.createRange();
		range.selectNodeContents(popup);
		range.deleteContents();
		range.detach();
	},
  
	// collapse/expand 
	autoCollapse  : false,
	
	get contentOuterBox() 
	{
		if (!this._contentOuterBox)
			this._contentOuterBox = document.getElementById('webmap-content-outer-box');
		return this._contentOuterBox;
	},
	_contentOuterBox : null,
 
	collapseExpand : function(aNotToSave) 
	{
		if (this.menuShown ||
			WebMapCommand.toolbarCustomizing ||
			WebMapCommand.isDragging ||
			window.windowState == window.STATE_MINIMIZED)
			return;

		if (this.contentOuterBox.boxObject.height)
			this.contentHeight = this.contentOuterBox.boxObject.height; // í‚ÉAŠJ‚¢‚½ó‘Ô‚Ì‚‚³‚ð•ÛŽ‚µ‚Ä‚¨‚­

		WebMapView.hideScrollButtons(true);

		var collapse = !this.contentOuterBox.collapsed;

		WebMapView.viewWidthRevision = collapse ? WebMapView.world.viewWidth : 0 ;
		WebMapView.viewHeightRevision = collapse ? this.contentHeight : 0 ;

		this.contentOuterBox.collapsed = collapse;
		window.resizeBy(
			0,
			collapse ? -this.contentHeight : this.contentHeight
		);

		WebMapService.notifyObservers('webmap:view:state', 'collapsed\n'+collapse);

		if (!aNotToSave)
			window.setTimeout('WebMapViewUI.saveSize();', 0);
	},
	saveSize : function()
	{
		WebMapService.setPref('webmap.view.collapsed',     this.contentOuterBox.collapsed);
		WebMapService.setPref('webmap.view.contentHeight', this.contentHeight);
	},
 
	toggleAutoCollapse : function() 
	{
		this.autoCollapse = !WebMapService.getPref('webmap.view.autoCollapse');
		WebMapService.setPref('webmap.view.autoCollapse', this.autoCollapse);

		if (!this.autoCollapse && this.contentOuterBox.collapsed)
			this.collapseExpand();
	},
	
	collapseExpandAutomatically : function(aEvent) 
	{
		if (!WebMapViewUI.autoCollapse) return;

		var x = 'screenX' in aEvent ? aEvent.screenX : 0 ;
		var y = 'screenY' in aEvent ? aEvent.screenY : 0 ;
		if (WebMapViewUI.contentOuterBox.collapsed) {
			if (aEvent.type == 'blur') return;
			if (
				aEvent.type == 'focus' ||
				(
					x >= window.screenX &&
					x <= window.screenX + window.outerWidth &&
					y >= window.screenY &&
					y <= window.screenY + window.outerHeight
				)
				)
				WebMapViewUI.collapseExpand();
		}
		else {
			if (aEvent.type == 'focus') return;
			if (
				aEvent.type == 'blur' ||
				(
					x < window.screenX ||
					x > window.screenX + window.outerWidth ||
					y < window.screenY ||
					y > window.screenY + window.outerHeight
				)
				)
				WebMapViewUI.collapseExpand();
		}
	},
 
	onBrowserFocus : function() 
	{
		if (this.autoCollapse && !this.contentOuterBox.collapsed)
			this.collapseExpand();
	},
   
	// rise on top 
	
	toggleAlwaysRaised : function() 
	{
		// On Mac OS, "always raised" windows are shown as modal dialogs.
		// We have to ignore this operation because "always raised" view window prevents to use main browser-window.
		if (navigator.platform.match(/mac/i)) {
			WebMapService.setPref('webmap.view.alwaysRaised', false);
			return;
		}

		var alwaysRaised = !WebMapService.getPref('webmap.view.alwaysRaised');
		WebMapService.setPref('webmap.view.alwaysRaised', alwaysRaised);

		WebMapService.notifyObservers('webmap:view:state', 'always-raised\n'+alwaysRaised);
	},
  
	toggleAutoClose : function() 
	{
		WebMapService.setPref('webmap.view.sync_open_state.enabled', !WebMapService.getPref('webmap.view.sync_open_state.enabled'));
	},
 
	toggleAutoMinimize : function() 
	{
		WebMapService.setPref('webmap.view.sync_minimize_state.enabled', !WebMapService.getPref('webmap.view.sync_minimize_state.enabled'));
	},
 
	get domainNodesList() 
	{
		return document.getElementById('webmap-domain-nodes-list');
	},
	
	showDomainNodesList : function(aEvent) 
	{
		this.domainNodesList.domainNode   = aEvent.target;
		this.domainNodesList.autoPosition = false;
		this.domainNodesList.showPopup(
			this.domainNodesList,
			aEvent.clientX,
			aEvent.clientY,
			'popup',
			null,
			null
		);
	},
 
	initDomainNodesList : function(aPopup) 
	{
		var node = aPopup.domainNode;
		var nodes = WebMapView.viewDocument.getElementsByAttribute('domain'+WebMapView.DOMAIN_SAME, node.domain);
		for (var i = 0; i < nodes.length; i++)
		{
			aPopup.appendChild(document.createElement('menuitem'));
			aPopup.lastChild.setAttribute('class', 'menuitem-iconic');
			aPopup.lastChild.setAttribute('label', nodes[i].label);
			aPopup.lastChild.setAttribute('image', nodes[i].image);
			aPopup.lastChild.setAttribute('target-node-id', nodes[i].id);
			aPopup.lastChild.setAttribute('oncommand', 'WebMapCommand.onNodeMenuItemCommand(event, true);');
			aPopup.lastChild.setAttribute('onclick', 'WebMapCommand.onNodeMenuItemClick(event, true); }');
		}

		aPopup.setAttribute('style', 'max-width:'+WebMapService.getPref('webmap.menu.domain_nodes_list.width')+'em;');
	},
 
	destroyDomainNodesList : function(aPopup) 
	{
		var range = document.createRange();
		range.selectNodeContents(aPopup);
		range.deleteContents();
		range.detach();
	},
  
	get arcPopup() 
	{
		return document.getElementById('webmap-arc-popup');
	},
	
	showArcPopup : function(aEvent) 
	{
		var arc = WebMapCommand.getRealTarget(aEvent.target);
		this.initArcPopup(this.arcPopup, arc);
		this.arcPopup.arcID = arc.id;
		this.arcPopup.autoPosition = false;
		this.arcPopup.showPopup(
			this.arcPopup,
			aEvent.clientX,
			aEvent.clientY,
			'popup',
			null,
			null
		);
	},
  
	observe : function(aSubject, aTopic, aData) 
	{
		var msg;
		aData = (String(aData) || '').split('\n');
		switch (aTopic)
		{
			case 'webmap:view:build':
				switch (aData[0])
				{
					case 'node':
						msg = document.getElementById('status-message-build-node').getAttribute('value')
								.replace(/%uri%/gi, aData[1]);
						this.isBusy = true;
						break;

					case 'arc':
						msg = document.getElementById('status-message-build-arc').getAttribute('value')
								.replace(/%uri1%/gi, aData[1])
								.replace(/%uri2%/gi, aData[2]);
						this.isBusy = true;
						break;

					case 'start':
						msg = document.getElementById('status-message-build-start').getAttribute('value');
						this.isBusy = true;
						break;

					case 'end':
						msg = document.getElementById('status-message-build-end').getAttribute('value');
						this.isBusy = false;
						break;
				}
				this.setMessage(msg);
				break;

			case 'webmap:toolbar-customized':
				var zoomItem = this.toolbarZoomItem;
				if (zoomItem)
					zoomItem.valueNode.value = WebMapView.world.scale;
				break;

			case 'webmap:world-zoomed':
				this.toolbarZoomItem.valueNode.value = WebMapView.world.scale;
				break;

			case 'webmap:world-moved':
				if (WebMapService.getPref('webmap.status.pan')) {
					this.statusPan.x.value = Math.round(Number(aData[0]));
					this.statusPan.y.value = Math.round(Number(aData[1]));
					this.showStatus(this.statusPan);
				}
				break;

			case 'webmap:node-moved':
				if (WebMapService.getPref('webmap.status.node_move')) {
					this.statusMove.x.value = Math.round(Number(aData[0]));
					this.statusMove.y.value = Math.round(Number(aData[1]));
					this.showStatus(this.statusMove);
				}
				break;

			case 'webmap:view:state':
				var menuitem;
				switch (aData[0])
				{
					case 'map-mode':
						if (this.toolbarMapModeItem)
							this.toolbarMapModeItem.checked = aData[1] == 'all';

						menuitem = document.getElementById('menubar-view-item-mode');
						if (aData[1] == 'all')
							menuitem.setAttribute('checked', true);
						else
							menuitem.removeAttribute('checked');
						break;

					case 'collapsed':
						if (this.toolbarCollapseItem)
							this.toolbarCollapseItem.checked = aData[1] == 'true';

						menuitem = document.getElementById('menubar-view-item-collapse');
						if (aData[1] == 'true')
							menuitem.setAttribute('checked', true);
						else
							menuitem.removeAttribute('checked');
						break;

					default:
						break;
				}
				break;

			case 'webmap:view:node-operation':
				var node = WebMapView.getNode(aData[1]);
				switch (aData[0])
				{
					case 'mouseover':
						if (WebMapCommand.isDragging) return;
						if (node.type == 'domain-node')
							msg = document.getElementById('status-message-domain-mouseover').getAttribute('value')
									.replace(/%uri%/gi, node.id)
									.replace(/%title%/gi, node.label)
									.replace(/%count%/gi, node.count);
						else
							msg = document.getElementById('status-message-node-mouseover').getAttribute('value')
									.replace(/%uri%/gi, node.id)
									.replace(/%title%/gi, node.label);
						window.setTimeout(function() {
							WebMapViewUI.setMessage(msg);
							msg = null;
						}, 0);
						break;

					case 'mouseout':
						if (WebMapCommand.isDragging) return;
						if (node.type == 'domain-node')
							msg = document.getElementById('status-message-domain-mouseout').getAttribute('value')
									.replace(/%uri%/gi, node.id)
									.replace(/%title%/gi, node.label)
									.replace(/%count%/gi, node.count);
						else
							msg = document.getElementById('status-message-node-mouseout').getAttribute('value')
								.replace(/%uri%/gi, node.id)
								.replace(/%title%/gi, node.label);
						window.setTimeout(function() {
							WebMapViewUI.setMessage(msg);
							msg = null;
						}, 0);
						break;

					default:
						break;
				}
				break;

			case 'webmap:view:arc-operation':
				var arc = WebMapView.getArcById(aData[1]);
				switch (aData[0])
				{
					case 'mouseover':
						if (WebMapCommand.isDragging) return;
						msg = document.getElementById(arc.interactive ? 'status-message-arc-interactive-mouseover' : 'status-message-arc-mouseover').getAttribute('value')
								.replace(/%uri1%/gi, arc.fromNode.id)
								.replace(/%title1%/gi, arc.fromNode.label)
								.replace(/%uri2%/gi, arc.targetNode.id)
								.replace(/%title2%/gi, arc.targetNode.label);
						window.setTimeout(function() {
							WebMapViewUI.setMessage(msg);
							msg = null;
						}, 0);
						break;

					case 'mouseout':
						if (WebMapCommand.isDragging) return;
						msg = document.getElementById(arc.interactive ? 'status-message-arc-interactive-mouseout' : 'status-message-arc-mouseout').getAttribute('value')
								.replace(/%uri1%/gi, arc.fromNode.id)
								.replace(/%title1%/gi, arc.fromNode.label)
								.replace(/%uri2%/gi, arc.targetNode.id)
								.replace(/%title2%/gi, arc.targetNode.label);
						window.setTimeout(function() {
							WebMapViewUI.setMessage(msg);
							msg = null;
						}, 0);
						break;

					default:
						break;
				}
				break;

			case 'webmap:browser-operation':
				if (aData[0] == 'focus')
					this.onBrowserFocus();
				break;

			default:
				break;
		}
	},
 
	init : function() 
	{
		if (this.activated) return;
		this.activated = true;

		var nullPointer;
		nullPointer = this.toolbarZoomItem;
		nullPointer = this.toolbarMapModeItem;
		nullPointer = this.toolbarCollapseItem;
		nullPointer = this.throbber;

		var menuitem;

		this.autoCollapse  = WebMapService.getPref('webmap.view.autoCollapse') || false ;
		this.contentHeight = WebMapService.getPref('webmap.view.contentHeight');
		menuitem = document.getElementById('menubar-view-item-autoCollapse');
		if (this.autoCollapse)
			menuitem.setAttribute('checked', true);
		else
			menuitem.removeAttribute('checked');

		window.addEventListener('mouseover', this.collapseExpandAutomatically, true);
		window.addEventListener('mouseout',  this.collapseExpandAutomatically, true);
		window.addEventListener('focus',     this.collapseExpandAutomatically, true);
		window.addEventListener('blur',      this.collapseExpandAutomatically, false);
		if (WebMapService.getPref('webmap.view.collapsed'))
			window.setTimeout('WebMapViewUI.collapseExpand();', 0);


		menuitem = document.getElementById('menubar-view-item-alwaysRaised');
		if (WebMapService.getPref('webmap.view.alwaysRaised'))
			menuitem.setAttribute('checked', true);
		else
			menuitem.removeAttribute('checked');


		menuitem = document.getElementById('menubar-view-item-mode');
		if (WebMapService.getPref('webmap.world.mode') == 'all')
			menuitem.setAttribute('checked', true);
		else
			menuitem.removeAttribute('checked');


		WebMapService.nsIObserverService.addObserver(this, 'webmap:view:build', false);

		WebMapService.nsIObserverService.addObserver(this, 'webmap:toolbar-customized', false);

		WebMapService.nsIObserverService.addObserver(this, 'webmap:world-zoomed', false);
		WebMapService.nsIObserverService.addObserver(this, 'webmap:world-moved', false);

		WebMapService.nsIObserverService.addObserver(this, 'webmap:node-moved', false);
		WebMapService.nsIObserverService.addObserver(this, 'webmap:view:node-operation', false);
		WebMapService.nsIObserverService.addObserver(this, 'webmap:view:arc-operation', false);

		WebMapService.nsIObserverService.addObserver(this, 'webmap:view:state', false);

		WebMapService.nsIObserverService.addObserver(this, 'webmap:browser-operation', false);
	},
 
	destroy : function() 
	{
		if (!this.activated) return;
		this.activated = false;


		window.removeEventListener('mouseover', this.collapseExpandAutomatically, true);
		window.removeEventListener('mouseout',  this.collapseExpandAutomatically, true);
		window.removeEventListener('focus',     this.collapseExpandAutomatically, true);
		window.removeEventListener('blur',      this.collapseExpandAutomatically, false);

		if (this.contentOuterBox.collapsed)
			this.collapseExpand(true);

		WebMapService.nsIObserverService.removeObserver(this, 'webmap:view:build');

		WebMapService.nsIObserverService.removeObserver(this, 'webmap:toolbar-customized');

		WebMapService.nsIObserverService.removeObserver(this, 'webmap:world-zoomed');
		WebMapService.nsIObserverService.removeObserver(this, 'webmap:world-moved');

		WebMapService.nsIObserverService.removeObserver(this, 'webmap:node-moved');
		WebMapService.nsIObserverService.removeObserver(this, 'webmap:view:node-operation');
		WebMapService.nsIObserverService.removeObserver(this, 'webmap:view:arc-operation');

		WebMapService.nsIObserverService.removeObserver(this, 'webmap:view:state');

		WebMapService.nsIObserverService.removeObserver(this, 'webmap:browser-operation');
	},
 
	toString : function()
	{
		return '[object WebMapViewUI]';
	}
}; 
  
