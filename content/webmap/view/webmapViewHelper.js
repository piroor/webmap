function WebMapNodeHelper(aNode) 
{
	this.init(aNode);
}

WebMapNodeHelper.prototype = {
	arcs : null,
	node : null,
	
	// nsIObserver 
	observe : function(aSubject, aTopic, aData)
	{
		if (!this.node || !this.node.parentNode) {
			this.destroy();
			return;
		}

		switch (aTopic)
		{
			case 'webmap:view:node-operation:all':
				if (aData == 'redraw') {
//					if (WebMapView.isNodeVisible(this))
						this.node.redraw();
				}
				else if (aData == 'clear-focus')
					this.node.focused = false;
				else if (aData == 'select')
					this.node.selected = true;
				else if (aData == 'unselect')
					this.node.selected = false;
				break;

			case 'webmap:view:node-operation:domain:'+this.node.domain:
				if (aData == 'redraw')
					this.node.redraw();
				else if (this.node.type == 'page-node') {
					if (aData == 'select')
						this.node.selected = true;
					else if (aData == 'unselect')
						this.node.selected = false;
					else if (aData == 'remove')
						WebMapService.removeNode(this.node.resource);
				}
				break;

			case 'webmap:view:window':
				if (aData == 'close')
					this.destroy();

			default:
				break;
		}
	},
 
	init : function(aNode) 
	{
if (WebMapService.debug) {
dump('INITIALIZE WEBMAP NODE HELPER\n');
dump(' ==> '+aNode.type+' / '+aNode.id+'\n');
}
//		sv.notifyObservers('webmap:view:build', 'node\n'+aNode.id);

		this.node = aNode;
		this.arcs = {
			length : 0
		};

		this.domain = aNode.domain;

		if (!(aNode.id in WebMapView.buildingNodes))
			WebMapView.buildingNodes[aNode.id] = true;

		window.setTimeout(function() {
			WebMapView.registerNode(aNode);
			if (aNode.type == 'domain-node')
				aNode.updateDomainPosition();

			if (aNode.focused)
				WebMapService.notifyObservers('webmap:service:node-operation', 'focus\nupdate\n'+aNode.id);

			aNode.helper.startObserve();
		}, 1);
	},
 
	startObserve : function() 
	{
		const nsIObserverService = Components.classes['@mozilla.org/observer-service;1'].getService(Components.interfaces.nsIObserverService);

		nsIObserverService.addObserver(this, 'webmap:view:node-operation:all', false);
		nsIObserverService.addObserver(this, 'webmap:view:node-operation:domain:'+this.domain, false);
		nsIObserverService.addObserver(this, 'webmap:view:window', false);
	},
 
	destroy : function() 
	{
		try {
			const nsIObserverService = Components.classes['@mozilla.org/observer-service;1'].getService(Components.interfaces.nsIObserverService);

			nsIObserverService.removeObserver(this, 'webmap:view:node-operation:all');
			nsIObserverService.removeObserver(this, 'webmap:view:node-operation:domain:'+this.domain);
			nsIObserverService.removeObserver(this, 'webmap:view:window');
		}
		catch(e) {
		}
	},
 
	toString : function()
	{
		return '[object WebMapNodeHelper]';
	}
}; 
  
function WebMapArcHelper(aNode) 
{
	this.init(aNode);
}

WebMapArcHelper.prototype = {
	node      : null,
	redrawing : false,
	
	// nsIObserver 
	observe : function(aSubject, aTopic, aData)
	{
		if (!this.node || !this.node.parentNode) {
			this.destroy();
			return;
		}

		switch (aTopic)
		{
			case 'webmap:view:arc-operation:'+this.fromURI:
			case 'webmap:view:arc-operation:'+this.targetURI:
				if (aData == 'redraw')
					this.node.redraw();
				break;

			case 'webmap:view:arc-operation:all':
				if (aData == 'redraw')
					this.node.redraw();
				else if (aData == 'clear-focus')
					this.node.removeAttribute('arc-pointed');
				break;

			case 'webmap:view:node-operation:all':
				if (aData == 'select')
					this.node.selected = true;
				else if (aData == 'unselect')
					this.node.selected = false;
				break;

			case 'webmap:view:node-operation:neighbor:'+this.fromURI:
				if (aData == 'select')
					this.node.targetNode.selected = true;
				else if (aData == 'unselect')
					this.node.targetNode.selected = false;
				break;

			case 'webmap:view:node-operation:neighbor:'+this.targetURI:
				if (aData == 'select')
					this.node.fromNode.selected = true;
				else if (aData == 'unselect')
					this.node.fromNode.selected = false;
				break;

			case 'webmap:view:node-operation:'+this.fromURI:
			case 'webmap:view:node-operation:'+this.targetURI:
				if (aData == 'unregister')
					WebMapView.unregisterArc(this.node);
				else if (aData == 'select' || aData == 'unselect') {
					this.node.selected = (aData == 'select');
					if (aTopic == 'webmap:view:node-operation:'+this.fromURI)
						this.node.targetNode.neighborSelected = (aData == 'select');
					else if (aTopic == 'webmap:view:node-operation:'+this.targetURI)
						this.node.fromNode.neighborSelected = (aData == 'select');
				}
				break;

			case 'webmap:view:window':
				if (aData == 'close')
					this.destroy();
				break;

			default:
				break;
		}
	},
 
	init : function(aNode) 
	{
if (WebMapService.debug) {
dump('INITIALIZE WEBMAP ARC HELPER\n');
dump(' ==> '+aNode.fromURI+'\n     '+aNode.targetURI+'\n');
}
//		WebMapService.notifyObservers('webmap:view:build', 'arc\n'+fromURI+'\n'+targetURI);

		this.node      = aNode;
		this.fromURI   = aNode.fromURI;
		this.targetURI = aNode.targetURI;

		if (!(aNode.id in WebMapView.buildingArcs))
			WebMapView.buildingArcs[aNode.id] = true;

		window.setTimeout(function() {
			WebMapView.registerArc(aNode);

			aNode.helper.startObserve();
		}, 1);
	},
 
	startObserve : function() 
	{
		const nsIObserverService = Components.classes['@mozilla.org/observer-service;1'].getService(Components.interfaces.nsIObserverService);

		nsIObserverService.addObserver(this, 'webmap:view:arc-operation:'+this.fromURI, false);
		nsIObserverService.addObserver(this, 'webmap:view:arc-operation:'+this.targetURI, false);
		nsIObserverService.addObserver(this, 'webmap:view:arc-operation:all', false);
		nsIObserverService.addObserver(this, 'webmap:view:node-operation:all', false);
		nsIObserverService.addObserver(this, 'webmap:view:node-operation:neighbor:'+this.fromURI, false);
		nsIObserverService.addObserver(this, 'webmap:view:node-operation:neighbor:'+this.targetURI, false);
		nsIObserverService.addObserver(this, 'webmap:view:node-operation:'+this.fromURI, false);
		nsIObserverService.addObserver(this, 'webmap:view:node-operation:'+this.targetURI, false);

		nsIObserverService.addObserver(this, 'webmap:view:window', false);
	},
 
	destroy : function() 
	{
		try {
			const nsIObserverService = Components.classes['@mozilla.org/observer-service;1'].getService(Components.interfaces.nsIObserverService);

			nsIObserverService.removeObserver(this, 'webmap:view:arc-operation:'+this.fromURI);
			nsIObserverService.removeObserver(this, 'webmap:view:arc-operation:'+this.targetURI);
			nsIObserverService.removeObserver(this, 'webmap:view:arc-operation:all');
			nsIObserverService.removeObserver(this, 'webmap:view:node-operation:all');
			nsIObserverService.removeObserver(this, 'webmap:view:node-operation:neighbor:'+this.fromURI);
			nsIObserverService.removeObserver(this, 'webmap:view:node-operation:neighbor:'+this.targetURI);
			nsIObserverService.removeObserver(this, 'webmap:view:node-operation:'+this.fromURI);
			nsIObserverService.removeObserver(this, 'webmap:view:node-operation:'+this.targetURI);

			nsIObserverService.removeObserver(this, 'webmap:view:window');
		}
		catch(e) {
		}
	},
 
	toString : function()
	{
		return '[object WebMapArcHelper]';
	}
}; 
  
