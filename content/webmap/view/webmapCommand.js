var WebMapCommand = { 

	NONE        : -1,
	CURRENT_TAB : 0,
	NEW_TAB     : 1,
	NEW_WINDOW  : 2,

	TOGGLE_SELECT          : 10,
	TOGGLE_SELECT_DOMAIN   : 11,
	TOGGLE_SELECT_NEIGHBOR : 12,

	ANCHOR_NODE : 10,
	TARGET_NODE : 11,


	isDragging : false,

	lastMouseDownX : 0,
	lastMouseDownY : 0,

	draggingNode          : null,
	draggingNodes         : [],
	draggingStartX        : 0,
	draggingStartY        : 0,
	draggingStartClientX  : 0,
	draggingStartClientY  : 0,
	dragNodeScrollListener : {},

	isPanning : false,
	panStartX : 0,
	panStartY : 0,

	isRotating    : false,
	startRotation : 0,

	isZooming  : false,
	startScale : 100,

	contextNode : null,
	contextArc  : null,
	
	// references 
	
	get service() 
	{
		return window.WebMapService;
	},
 
	get view() 
	{
		return window.WebMapView;
	},
 
	get redrawInterval() 
	{
		return Math.max(this.service.getPref('webmap.redraw.interval'), 1);
	},
  
	getRealTarget : function(aNode) 
	{
		if (aNode.id == 'arc-marker-image')
			aNode = aNode.arc;
		return aNode;
	},
 
	// manage nodes and arcs 
	
	loadNode : function(aNode, aOpenIn) 
	{
		if (!aNode) return;

		if (aNode.type == 'domain-node') {
			var nodes = aNode.nodes;
			if (nodes.length == 1) {
				this.loadNode(nodes[0], aOpenIn);
			}
			return;
		}


		var uri = aNode.URI;

		var nav = this.service.browserWindow;
		if (!nav)
			aOpenIn = this.NEW_WINDOW;

		var i;
		switch (aOpenIn)
		{
			default:
			case this.CURRENT_TAB:
				nav.gBrowser.loadURI(uri);
				break;

			case this.NEW_TAB:
				var newTab = nav.gBrowser.addTab(uri);
				if (!this.service.getPref('browser.tabs.loadInBackground'))
					nav.gBrowser.selectedTab = newTab;
				break;

			case this.NEW_WINDOW:
				window.open(uri);
				break;
		}
	},
	
	loadNodes : function(aNodes, aOpenIn, aSelectFirstTab) 
	{
		if (!aNodes || !aNodes.length) return;
		var i, j;

		var nav   = this.service.browserWindow;
		if (aOpenIn == this.NEW_TAB && !nav) return;


		if (aNodes[0].type == 'domain-node') {
			var nodes;
			var nodesInDomain;
			for (i = 0; i < aNodes.length; i++)
			{
				nodes = aNodes[i].nodes;
				nodesInDomain = [];
				for (j = 0; i < nodes.length; j++)
					nodesInDomain.push(nodes[j]);

				this.loadNodes(nodesInDomain, aOpenIn, i == 0);
			}
			return;
		}


		if (aSelectFirstTab === void(0)) aSelectFirstTab = true;

		switch (aOpenIn)
		{
			case this.NEW_TAB:
				var firstTab;
				for (i = 0; i < aNodes.length; i++)
				{
					if (!firstTab)
						firstTab = nav.gBrowser.addTab(aNodes[i].URI);
					else
						nav.gBrowser.addTab(aNodes[i].URI);
				}
				if (aSelectFirstTab &&
					!this.service.getPref('browser.tabs.loadInBackground'))
					nav.gBrowser.selectedTab = firstTab;
				break;

			case this.NEW_WINDOW:
				for (i = 0; i < aNodes.length; i++)
					window.open(aNodes[i].URI);
				break;

			default:
				break;
		}
	},
  
	selectSameDomainNodes : function(aNode) 
	{
		if (!aNode || aNode.type == 'domain-node') return;

		this.view.clearSelection();

		this.service.notifyObservers('webmap:view:node-operation:domain:'+aNode.domain, 'select');

		this.view.redraw();
	},
	
	unselectSameDomainNodes : function(aNode) 
	{
		if (!aNode || aNode.type == 'domain-node') return;

		this.service.notifyObservers('webmap:view:node-operation:domain:'+aNode.domain, 'unselect');

		this.view.redraw();
	},
  
	selectNeighborNodes : function(aNode) 
	{
		if (!aNode) return;

		this.view.clearSelection();

		aNode.selected = true;
		this.service.notifyObservers('webmap:view:node-operation:neighbor:'+aNode.id, 'select');

		this.view.redraw();
	},
	
	unselectNeighborNodes : function(aNode) 
	{
		if (!aNode) return;

		aNode.selected = false;
		this.service.notifyObservers('webmap:view:node-operation:neighbor:'+aNode.id, 'unselect');

		this.view.redraw();
	},
  
	selectAllNodes : function() 
	{
		this.service.notifyObservers('webmap:view:node-operation:all', 'select');

		this.view.redraw();
	},
 
	removeNode : function(aNode) 
	{
		if (!aNode) return;

		if (aNode.type == 'domain-node') {
			this.service.notifyObservers('webmap:view:node-operation:domain:'+aNode.domain, 'remove');
		}
		else {
			this.service.removeNode(aNode.resource);
		}
	},
	
	removeNodes : function(aNodes) 
	{
		if (!aNodes || !aNodes.length) return;

		for (var i = 0; i < aNodes.length; i++)
			this.removeNode(aNodes[i]);
	},
  
	removeArc : function(aArc) 
	{
		if (!aArc) return;

		if (aArc.fromNode.type == 'domain-node') {
			// ...How to do I this ?!
		}
		else
			this.service.removeArc(aArc.resource);
	},
 
	moveNodeTo : function(aNode, aX, aY) 
	{
		this.service.notifyObservers('webmap:node-moved', aX+'\n'+aY);

		aNode.x = aX-aNode.offsetX;
		aNode.y = aY-aNode.offsetY;

		if (aNode.type == 'domain-node') {
			aNode.updateNodesPosition();
		}
		else {
			aNode.updateDomainPosition();
		}
	},
  
	enterPanMode : function() 
	{
		this.isPanning = true;
		this.view.canvas.setAttribute('panning', true);
		this.panStartX = this.view.world.x;
		this.panStartY = this.view.world.y;
	},
 
	goToNodeOf : function(aArc, aNodeType) 
	{
		if (!aArc) return;

		var focusNode = (aNodeType == this.ANCHOR_NODE) ? aArc.fromNode :
						(aNodeType == this.TARGET_NODE) ? aArc.targetNode :
						null ;
		if (!focusNode) return;

		focusNode.focused = true;
		this.view.scrollToNode(focusNode);

		if (this.service.getPref('webmap.view.autoload.goto_from_arc'))
			this.loadNode(focusNode);
	},
 
	minimize : function() 
	{
//		if (WebMapViewUI.contentOuterBox.collapsed)
//			WebMapViewUI.collapseExpand(true);

		window.minimize();
	},
	
	restore : function() 
	{
//		if (WebMapViewUI.autoCollapse &&
//			!WebMapViewUI.contentOuterBox.collapsed)
//			WebMapViewUI.collapseExpand(true);

		window.restore();
	},
  
	isWebMapNode : function(aNode) 
	{
		return (
				aNode &&
				aNode.nodeType == Node.ELEMENT_NODE &&
				aNode.getAttribute('class') == 'webmap-node'
			);
	},
 
	isWebMapArc : function(aNode) 
	{
		return (
				aNode &&
				aNode.nodeType == Node.ELEMENT_NODE &&
				aNode.getAttribute('class') == 'webmap-arc'
			);
	},
 
	isActive : function(aNode) 
	{
		return (aNode && 'active' in aNode) ? aNode.active : true ;
	},
 
	// event handling 
	
	onDragStart : function(aEvent) 
	{
		var target = this.getRealTarget(aEvent.target);
		if (this.view.isBuilding ||
			!this.isActive(target)) return false;


		if (
			this.isWebMapNode(target) ||
			this.isWebMapArc(target)
			) {
			if (
				(
					aEvent.button != 0 &&
					aEvent.button != 1
				) ||
//				aEvent.ctrlKey ||
//				aEvent.shiftKey ||
				aEvent.metaKey ||
				aEvent.altKey
				)
				return false;

			var startNode;
			if (this.isWebMapNode(target)) {
				if (
					aEvent.button == 1 ||
					(
						aEvent.shiftKey &&
						!(aEvent.ctrlKey || aEvent.metaKey)
					)
					) {
					target.selected = true;
					this.selectSameDomainNodes(target);
				}
				else if (
					aEvent.button == 0 &&
					(aEvent.ctrlKey || aEvent.metaKey) &&
					!aEvent.shiftKey
					) {
					this.selectNeighborNodes(target);
				}
				startNode = target;
			}
			else { // arc
				target.fromNode.selected = true;
				target.targetNode.selected = true;
				startNode = target.fromNode;
			}

			this.onStartNodeDrag(aEvent, startNode);

			return true;
		}
		else if (aEvent.button == 0) {

/*			if (
				!aEvent.ctrlKey &&
				aEvent.altKey &&
				!aEvent.shiftKey &&
				!aEvent.metaKey
				) {
				this.isRotating = true;
				this.view.canvas.setAttribute('rotating', true);
				this.startRotation = this.view.world.rotation;
				this.isDragging = true;
//				this.view.preventShowHideScrollButtons = true;

				return true;
			}
			else*/ if (
				!aEvent.ctrlKey &&
				!aEvent.altKey &&
				aEvent.shiftKey &&
				!aEvent.metaKey
				) {
				this.enterPanMode();
				this.isDragging = true;
//				this.view.preventShowHideScrollButtons = true;

				return true;
			}
			else if (
				(aEvent.ctrlKey || aEvent.metaKey) &&
				!aEvent.altKey &&
				!aEvent.shiftKey
				) {
				this.isZooming = true;
				this.view.canvas.setAttribute('zooming', true);
				this.startScale = this.view.world.scale;
				this.isDragging = true;
//				this.view.preventShowHideScrollButtons = true;

				return true;
			}
		}

		return false;
	},
	
	onStartNodeDrag : function(aEvent, aNode) 
	{
		this.draggingNode = aNode;
		if (!this.draggingNode.selected)
			this.view.clearSelection();

		this.draggingNode.selected = true;

		var node;
		while (this.draggingNodes.length)
		{
			node = this.draggingNodes.pop();
			node.selected   = false;
			node.isDragging = false;
			// save position
			node.x = node.x;
			node.y = node.y;
		}

		var dragNodes     = {};
		dragNodes[this.draggingNode.id] = this.draggingNode;

		var nodes = this.view.getSelectedNodes();
		if (nodes && nodes.length)
			for (i = 0; i < nodes.length; i++)
			{
				nodes[i].isDragging   = true;
				nodes[i].originalX    = nodes[i].x;
				nodes[i].originalY    = nodes[i].y;
				nodes[i].originalBoxX = nodes[i].boxX;
				nodes[i].originalBoxY = nodes[i].boxY;
				nodes[i].movingPower  = 1;

				this.draggingNodes.push(nodes[i]);

				dragNodes[nodes[i].id] = nodes[i];
			}


		// 子を持たない直接の子ノードのみを一緒に移動する
		if (this.draggingNodes.length == 1 &&
			this.service.getPref('webmap.view.move_with_child_nodes')) {
			nodes = this.view.getNeighborNodesOf(this.draggingNode);
			for (i = 0; i < nodes.length; i++)
			{
				if (nodes[i].arcs.length > 1) continue;

				nodes[i].selected = true;

				nodes[i].isDragging   = true;
				nodes[i].originalX    = nodes[i].x;
				nodes[i].originalY    = nodes[i].y;
				nodes[i].originalBoxX = nodes[i].boxX;
				nodes[i].originalBoxY = nodes[i].boxY;
				nodes[i].movingPower  = 1;

				this.draggingNodes.push(nodes[i]);

				dragNodes[nodes[i].id] = nodes[i];
			}
		}


		/* 偽バーテックスリレーション
			周囲の操作対象でないノードも一緒に引きずるように移動する。
			移動率は、操作対象のノードからの距離（直線距離ではなく、
			アークを経由しての総距離）に反比例する。
		*/
		if (this.service.getPref('webmap.view.vertexrelation.enabled')) {
if (this.service.debug) dump('vertex relation\n');

			function setMovingPowerForChildNodes(aNode, aGrid, aDistanceFromParent, aNest)
			{
				if (aNest >= WebMapService.getPref('webmap.view.vertexrelation.level')) return;

				var nodes = WebMapView.getNeighborNodesOf(aNode);
				var distance;
				var power;
				for (var i = 0; i < nodes.length; i++)
				{
					distance = aDistanceFromParent
							+ Math.sqrt(
								(aNode.x-nodes[i].x)*(aNode.x-nodes[i].x)
								+ (aNode.y-nodes[i].y)*(aNode.y-nodes[i].y)
							);
					/*
						他にたくさんのノードがぶら下がっているノードは、
						「重い」ので引きずられにくい。
						これを擬似的に再現するため、二倍の距離にあるのと
						同じと見なして移動率を下げる。
					*/
					distance *= nodes[i].arcs.length;

					power = Math.sqrt(aGrid/distance);

					if (
						(// 詳細表示の場合、同じドメインのノードのみを処理
							WebMapCommand.draggingNode.type != 'domain-node' &&
							WebMapCommand.draggingNode.domain != nodes[i].domain
						) ||
						nodes[i] == WebMapCommand.draggingNode ||
						nodes[i].seleced ||
						(
							nodes[i].id in dragNodes &&
							power <= nodes[i].movingPower
						)
						)
						continue;

if (WebMapService.debug) dump('  '+nodes[i].id+' ('+power+')\n');
					nodes[i].isDragging   = true;
					nodes[i].originalX    = nodes[i].x;
					nodes[i].originalY    = nodes[i].y;
					nodes[i].originalBoxX = nodes[i].boxX;
					nodes[i].originalBoxY = nodes[i].boxY;
					nodes[i].movingPower  = power;

					WebMapCommand.draggingNodes.push(nodes[i]);
					dragNodes[nodes[i].id] = nodes[i];

					setMovingPowerForChildNodes(nodes[i], aGrid, distance, aNest+1);
				}
			}

			// 一番近いノードまでの距離を求める
			var scanningNodes = this.view.getSelectedNodes();
			var grid;
			var j;
			for (i = 0; i < scanningNodes.length; i++)
			{
				nodes = this.view.getNeighborNodesOf(scanningNodes[i]);
				for (j = 0; j < nodes.length; j++)
				{
					distance = Math.sqrt((scanningNodes[i].x-nodes[j].x)*(scanningNodes[i].x-nodes[j].x) + (scanningNodes[i].y-nodes[j].y)*(scanningNodes[i].y-nodes[j].y));
					if (grid === void(0) || grid > distance)
						grid = distance;
				}
			}
			/*
				操作対象のノードの画面上での高さ（幅を使わないのは、
				ラベルの長さによって大きく変わるから）と、最短距離の0.6倍の
				どちらか小さい方を、バーテックスリレーションの計算基準にする。
			*/
			var height = this.draggingNode.height/(this.view.world.scale/100);
			grid = Math.min(height, grid*(grid/height));
			for (i = 0; i < scanningNodes.length; i++)
				setMovingPowerForChildNodes(scanningNodes[i], grid, 0, 1);
		}


		if (this.draggingStandByNode) {
			this.draggingStartX       = this.draggingStandByX;
			this.draggingStartY       = this.draggingStandByY;
			this.draggingStartClientX = this.draggingStandByClientX;
			this.draggingStartClientY = this.draggingStandByClientY;
		}
		else {
			this.draggingStartX       = this.view.world.x;
			this.draggingStartY       = this.view.world.y;
			this.draggingStartClientX = aEvent.clientX;
			this.draggingStartClientY = aEvent.clientY;
		}

		this.draggingNode.isDragging       = true;
		this.draggingNode.ignoreClickEvent = true;

		this.isDragging = true;

		this.view.world.registerScrollListener(this.dragNodeScrollListener);
//		this.view.preventShowHideScrollButtons = true;
	},
  
	onMouseDown : function(aEvent) 
	{
		var target = this.getRealTarget(aEvent.target);
		if (this.view.isBuilding ||
			!this.isActive(target)) return false;

		this.lastMouseDownX = aEvent.clientX;
		this.lastMouseDownY = aEvent.clientY;

		if (
			!this.isWebMapNode(target) &&
			aEvent.button == 1 &&
			!aEvent.shiftKey &&
			!aEvent.ctrlKey &&
			!aEvent.altKey &&
			!aEvent.metaKey
			) {
			this.view.canvas.setAttribute('panning', true);
			this.isPanning = true;
			this.panStartX = this.view.world.x;
			this.panStartY = this.view.world.y;
			this.isDragging = true;
//			this.view.preventShowHideScrollButtons = true;
		}
		else if (aEvent.button == 0 || aEvent.button == 1) {
			this.onStandByStartNodeDrag(aEvent);
		}
	},
	
	onStandByStartNodeDrag : function(aEvent) 
	{
		this.draggingStandByEvent = {};
		for (var i in aEvent)
		{
			try {
				this.draggingStandByEvent[i] = aEvent[i];
			}
			catch(e) {
				this.draggingStandByEvent[i] = null;
			}
		};

		this.draggingStandByNode    = this.getRealTarget(aEvent.target);
		this.draggingStandByX       = this.view.world.x;
		this.draggingStandByY       = this.view.world.y;
		this.draggingStandByClientX = aEvent.clientX;
		this.draggingStandByClientY = aEvent.clientY;
	},
  
	onMouseUp : function(aEvent) 
	{
		var target = this.getRealTarget(aEvent.target);
		if (this.view.isBuilding/* ||
			!this.isActive(target)*/) return false;

		if (this.draggingStandByNode) {
			this.draggingStandByEvent   = null;
			this.draggingStandByNode    = null;
			this.draggingStandByX       = 0;
			this.draggingStandByY       = 0;
			this.draggingStandByClientX = 0;
			this.draggingStandByClientY = 0;
		}

		if (this.isPanning) {
			this.isPanning = false;
			this.panStartX = 0;
			this.panStartY = 0;

			this.view.canvas.removeAttribute('panning');

			this.view.redraw();
		}
		if (this.isZooming) {
			this.view.canvas.removeAttribute('zooming');
			this.isZooming = false;
			this.startScale = 100;
		}
/*
		if (this.isRotating) {
			this.view.canvas.removeAttribute('rotating');
			this.isRotating = false;
			this.startRotation = 0;
		}
*/
		if (this.draggingNode) {
			var draggingNode = this.draggingNode;
			window.setTimeout(function() {
				draggingNode.ignoreClickEvent = false;

				var node;
				while (WebMapCommand.draggingNodes.length)
				{
					node = WebMapCommand.draggingNodes.pop();
					node.isDragging = false;
					// save position
					node.x = node.x;
					node.y = node.y;
				}
				draggingNode = null;
				node         = null;
			}, 0);

			draggingNode.isDragging = false;

			this.draggingNode         = null;
			this.draggingStartX       = 0;
			this.draggingStartY       = 0;
			this.draggingStartClientX = 0;
			this.draggingStartClientY = 0;

			this.view.world.unregisterScrollListener(this.dragNodeScrollListener);

			this.view.redraw();
		}

		this.isDragging = false;
//		this.view.preventShowHideScrollButtons = false;
	},
 
	onMouseMove : function(aEvent) 
	{
		if (this.view.isBuilding) return false;

		// dragging
		if (this.draggingStandByEvent &&
			this.onDragStart(this.draggingStandByEvent)) {
			this.draggingStandByEvent   = null;
			this.draggingStandByNode    = null;
			this.draggingStandByX       = 0;
			this.draggingStandByY       = 0;
			this.draggingStandByClientX = 0;
			this.draggingStandByClientY = 0;
			return;
		}


		var target = this.getRealTarget(aEvent.target);
		if (!this.isActive(target)) return false;


		if (this.isPanning) {
			this.view.pan(
				this.panStartX+(aEvent.clientX-this.lastMouseDownX),
				this.panStartY+(aEvent.clientY-this.lastMouseDownY)
			);
		}
		else if (this.isZooming && !this.zoomTimerWheel) {
			var newScale = (aEvent.clientY-this.lastMouseDownY)*Number(this.service.getPref('webmap.world.scale.drag.power'));

			if (this.service.getPref('webmap.world.scale.drag.reverse'))
				newScale = -newScale;

			this.view.zoom(this.startScale+newScale);
		}
/*
		else if (this.isRotating && !this.isWheelRotating) {
			var newRotation = (aEvent.clientY-this.lastMouseDownY)*Number(this.service.getPref('webmap.world.rotation.drag.power'))

			if (this.service.getPref('webmap.world.rotation.drag.reverse'))
				newRotation = -newRotation;

			this.view.rotate(this.startRotation+newRotation);
		}
*/
		else if (this.draggingNode) {
			var draggingOffsetX = this.draggingStartClientX + this.draggingStartX;
			var draggingOffsetY = this.draggingStartClientY + this.draggingStartY;

			var x = (aEvent.clientX-draggingOffsetX);
			var y = (aEvent.clientY-draggingOffsetY);

	//		var r = -(this.world.rotation*Math.PI/180);
	//		var rx = ((x * Math.cos(r))-(y * Math.sin(r))) / (this.world.scale/100);
	//		var ry = ((x * Math.sin(r))+(y * Math.cos(r))) / (this.world.scale/100);

			this.view.preventRedraw = true;

			var newX, newY;
			for (var i in this.draggingNodes)
			{
				newX = (x + this.draggingNodes[i].originalBoxX) / (this.view.world.scale/100);
				newY = (y + this.draggingNodes[i].originalBoxY) / (this.view.world.scale/100);

				if (this.draggingNodes[i].movingPower != 1) {
					newX -= ((newX - this.draggingNodes[i].originalX) * (1-this.draggingNodes[i].movingPower));
					newY -= ((newY - this.draggingNodes[i].originalY) * (1-this.draggingNodes[i].movingPower));
				}

				this.moveNodeTo(this.draggingNodes[i], newX, newY);
			}

			this.view.preventRedraw = false;

			this.view.redraw();
		}
	},
 
	onMouseScroll : function(aEvent) 
	{
		var target = WebMapCommand.getRealTarget(aEvent.target);

		var sv   = WebMapService;
		var view = WebMapView;
		var cmd  = WebMapCommand;
		var step;

		if (view.isBuilding ||
			!cmd.isActive(target)) return false;

/*		if (
			!aEvent.ctrlKey &&
			!aEvent.altKey &&
			!aEvent.metaKey
			) {
			var step = -Math.abs(sv.getPref('webmap.world.scroll.step.wheel'));
			if (aEvent.detail < 0)
				step = -step;

			view.pan(
				view.world.x+(aEvent.shiftKey ? step : 0 ),
				view.world.y+(!aEvent.shiftKey ? step : 0 )
			);
		}
*/
/*
		else if (
			!aEvent.ctrlKey &&
			aEvent.altKey &&
			!aEvent.shiftKey &&
			!aEvent.metatKey
			) {
			cmd.isRotating      = true;
			cmd.isWheelRotating = true;
			view.canvas.setAttribute('rotating', true);

			step = sv.getPref('webmap.world.rotation.step.wheel');

			if (aEvent.detail < 0)
				step = -step;
			if (sv.getPref('webmap.world.rotation.wheel.reverse'))
				step = -step;

			view.zoom(Math.round((view.world.rotation+step)/step)*step);

			view.canvas.removeAttribute('rotating');
			cmd.isRotating      = false;
			cmd.isWheelRotating = false;
		}
		else*/ if (
//			(aEvent.ctrlKey || aEvent.metatKey) &&
			!aEvent.ctrlKey &&
			!aEvent.altKey &&
			!aEvent.altKey &&
			!aEvent.shiftKey
			) {
			if (cmd.zoomTimerWheel) {
				window.clearTimeout(cmd.zoomTimerWheel);
				cmd.zoomTimerWheel = null;
			}

			cmd.isZooming      = true;

			view.canvas.setAttribute('zooming', true);

			var zoomIn = true;
			if (aEvent.detail < 0)
				zoomIn = !zoomIn;
			if (sv.getPref('webmap.world.scale.wheel.reverse'))
				zoomIn = !zoomIn;

			var power = Number(sv.getPref('webmap.world.scale.wheel.power') || 0);

			if (zoomIn)
				view.zoomIn(power);
			else
				view.zoomOut(power);

			cmd.zoomTimerWheel = window.setTimeout(function() {
				view.canvas.removeAttribute('zooming');
				cmd.isZooming      = false;
				cmd.zoomTimerWheel = null;
			}, cmd.redrawInterval);
		}

//		view.redraw();
	},
	zoomTimerWheel : null,
 
	onClick : function(aEvent) 
	{
		var target = this.getRealTarget(aEvent.target);

		if (this.view.isBuilding ||
			!this.isActive(target)) return false;

		var sv = this.service;

		this.view.content.focus();

		if (
			(
				aEvent.button == 0 ||
				aEvent.button == 1
			) &&
			!this.isWebMapNode(target) &&
			!this.isWebMapArc(target) &&
			Math.abs(this.lastMouseDownX-aEvent.clientX) < 5 &&
			Math.abs(this.lastMouseDownY-aEvent.clientY) < 5
			) {
			this.view.clearFocus();
			this.view.clearSelection();
			this.view.clearArcMarker();
			this.view.redraw();
		}

/*
		if (
			aEvent.button == 0 &&
			!aEvent.ctrlKey &&
			aEvent.altKey &&
			!aEvent.shiftKey &&
			!aEvent.metaKey
			) {
			this.view.world.rotation = 0;
			sv.setPref('webmap.world.rotation', this.view.world.rotation);
			this.view.redraw();
		}
*/

		if (this.isWebMapNode(target)) {
			var node = target;
			if (node.ignoreClickEvent) return;
			switch (node.type)
			{
				case 'domain-node':
					if (
						aEvent.button == 0 &&
						!aEvent.ctrlKey &&
						!aEvent.altKey &&
						!aEvent.shiftKey &&
						!aEvent.metaKey
						) {
						if (node.nodes.length > 1)
							WebMapViewUI.showDomainNodesList(aEvent);
					}

				default:
					var actionFlag = this.NONE;

					var b = this.service.browser;
					if (!b) {
						actionFlag = this.NEW_WINDOW;
					}
					else {
						switch(aEvent.button)
						{
							case 0:
								if (
									!aEvent.ctrlKey &&
									!aEvent.shiftKey &&
									!aEvent.metaKey &&
									!aEvent.altKey
									)
									actionFlag = this.CURRENT_TAB;
								else if (
									aEvent.ctrlKey &&
									!aEvent.shiftKey &&
									!aEvent.metaKey &&
									!aEvent.altKey
									)
									actionFlag = this.NEW_TAB;
								else if (
									!aEvent.ctrlKey &&
									aEvent.shiftKey &&
									!aEvent.metaKey &&
									!aEvent.altKey
									)
									actionFlag = this.TOGGLE_SELECT;
								else if (
									!aEvent.ctrlKey &&
									!aEvent.shiftKey &&
									!aEvent.metaKey &&
									aEvent.altKey
									)
									actionFlag = this.TOGGLE_SELECT_NEIGHBOR;
								break;

							case 1:
								actionFlag = this.NEW_TAB;
								break;

							default:
								break;
						}
					}

					switch(actionFlag)
					{
						case this.CURRENT_TAB:
						case this.NEW_TAB:
							this.loadNode(node, actionFlag);
							break;

						case this.TOGGLE_SELECT:
							node.selected = !node.selected;
							break;

						case this.TOGGLE_SELECT_NEIGHBOR:
							if (node.selected)
								this.unselectNeighborNodes(node);
							else
								this.selectNeighborNodes(node);
							break;

						default:
							break;
					}
					break;
			}
		}
		else if (this.isWebMapArc(target)) {
			if (
				aEvent.button == 0 &&
				!aEvent.ctrlKey &&
				!aEvent.altKey &&
				!aEvent.shiftKey &&
				!aEvent.metaKey
				) {
				WebMapViewUI.showArcPopup(aEvent);
			}
		}
	},
 
	onDblClick : function(aEvent) 
	{
		var target = this.getRealTarget(aEvent.target);

		if (this.view.isBuilding ||
			!this.isActive(target)) return false;

		if (this.isWebMapNode(target)) {
			var node = target;
			if (node.ignoreClickEvent) return;

			var actionFlag = this.NONE;
			switch(node)
			{
				case 0:
					if (
						!aEvent.ctrlKey &&
						aEvent.shiftKey &&
						!aEvent.metaKey &&
						!aEvent.altKey
						)
						actionFlag = this.TOGGLE_SELECT_DOMAIN;
					break;

				default:
					break;
			}

			switch(actionFlag)
			{
				case this.TOGGLE_SELECT_DOMAIN:
					if (node.selected)
						this.unselectSameDomainNodes(node);
					else
						this.selectSameDomainNodes(node);
					break;

				default:
					break;
			}

			return;
		}
		else if (this.isWebMapArc(target)) {
			if (
				aEvent.button == 0 &&
				!aEvent.ctrlKey &&
				!aEvent.altKey &&
				!aEvent.shiftKey &&
				!aEvent.metaKey
				) {
				var arc = target;

				var fromNode   = arc.fromNode;
				var targetNode = arc.targetNode;

				var fromVisible   = this.view.isNodeVisible(fromNode);
				var targetVisible = this.view.isNodeVisible(targetNode);
				var fromFocused   = fromNode.focused;
				var targetFocused = targetNode.focused;

				var focusNode;
				if (fromVisible == targetVisible) {
					if (targetFocused)
						focusNode = fromNode;
					else if (fromFocused)
						focusNode = targetNode;
					else {

						if (
							(targetNode.x-fromNode.x)/2/(this.view.scale/100) > aEvent.clientX+this.view.world.x ||
							(targetNode.y-fromNode.y)/2/(this.view.scale/100) > aEvent.clientY+this.view.world.y
							)
							focusNode = targetNode;
						else
							focusNode = fromNode;
					}
				}
				else if (fromVisible && !targetVisible) {
					focusNode = targetNode;
				}
				else /*if (!fromVisible && targetVisible)*/ {
					focusNode = fromNode;
				}

				focusNode.focused = true;
				this.view.scrollToNode(focusNode);
				this.loadNode(focusNode);
			}
		}
		else if (
			aEvent.button == 0 &&
			!aEvent.altKey &&
			!aEvent.ctrlKey &&
			!aEvent.shiftKey &&
			!aEvent.metaKey
			) {
			this.view.zoom(100);
		}
	},
 
	onScrollByKey : function(aEvent) 
	{
		if (this.view.isBuilding) return false;

		var step = Math.abs(this.service.getPref('webmap.world.scroll.step.key'));
		var dX, dY;
		switch (aEvent.keyCode)
		{
			case aEvent.DOM_VK_UP:
				dX = 0;
				dY = step;
				break;

			case aEvent.DOM_VK_DOWN:
				dX = 0;
				dY = -step;
				break;

			case aEvent.DOM_VK_RIGHT:
				dX = -step;
				dY = 0;
				break;

			case aEvent.DOM_VK_LEFT:
				dX = step;
				dY = 0;
				break;

			default:
				return;
		}

		this.view.pan(this.view.world.x+dX, this.view.world.y+dY);
	},
 
	onNodeMenuItemCommand : function(aEvent, aLoad) 
	{
		var node = this.view.getNode(aEvent.target.getAttribute('target-node-id'));

		var focusNode = node;
		if (this.view.mapMode == 'domain')
			focusNode = this.view.getNode(focusNode.domain) || node;

		focusNode.focused = true;
		this.view.scrollToNode(focusNode);
		if (aLoad)
			this.loadNode(node);
	},
	
	onNodeMenuItemClick : function(aEvent, aLoad) 
	{
		if (aEvent.button != 1) return;

		var popup = aEvent.target.parentNode;
		while (popup && 'hidePopup' in popup)
		{
			popup.hidePopup();
			popup = popup.parentNode.parentNode;
		}

		var node = this.view.getNode(aEvent.target.getAttribute('target-node-id'));

		var focusNode = node;
		if (this.view.mapMode == 'domain')
			focusNode = this.view.getNode(focusNode.domain) || node;

		focusNode.focused = true;
		this.view.scrollToNode(focusNode);
		if (aLoad)
			this.loadNode(node, this.NEW_TAB);
	},
  
	onThrobberCommand : function(aEvent) 
	{
		var uri = this.service.getPref('webmap.view.throbber.url');

		var nav = this.service.browserWindow;
		if (nav)
			nav.gBrowser.loadURI(uri);
		else
			window.open(uri);
	},
	
	onThrobberClick : function(aEvent) 
	{
		if (aEvent.button != 1) return;

		var uri = this.service.getPref('webmap.view.throbber.url');

		var nav = this.service.browserWindow;
		if (nav) {
			nav.gBrowser.loadURI(uri);
			var newTab = nav.gBrowser.addTab(uri);
			if (!this.service.getPref('browser.tabs.loadInBackground'))
				nav.gBrowser.selectedTab = newTab;
		}
		else
			window.open(uri);
	},
   
	// nsIObserver 
	observe : function(aSubject, aTopic, aData)
	{
		if (this.service.debug)
			dump('WebMapCommand::observe ('+aTopic+')\n  '+String(aData).replace(/\n/gi, '\n  ')+'\n');

		var id;
		aData = (String(aData) || '').split('\n');
		switch (aTopic)
		{
			case 'webmap:service:node-operation':
				if (
					!aData[0] ||
					aData[0] != 'focus' ||
					((aData[1] == 'load' || aData[1] == 'update') && !WebMapService.getPref('webmap.world.autoscroll.onload')) ||
					(aData[1] == 'tab' && !WebMapService.getPref('webmap.world.autoscroll.onfocus.tab')) ||
					(aData[1] == 'window' && !WebMapService.getPref('webmap.world.autoscroll.onfocus.window'))
					)
					return;

				window.setTimeout(function() {
					id = aData[2];
					if (WebMapView.checkNodeExists(id)) {
						var focusedNode = WebMapView.getNode(id);
						if (focusedNode) {
							if (WebMapView.getSelectedNodes().length == 1)
								WebMapView.clearSelection();

							if (WebMapService.getPref('webmap.world.mode') == 'domain') {
								var domainNode = WebMapView.getNode(focusedNode.domain);
								if (domainNode)
									focusNode = domainNode;
							}
							focusedNode.focused = true;
							if (!WebMapView.isNodeVisible(focusedNode))
								WebMapView.scrollToNode(focusedNode);

							aData = null;
							id    = null;
							return;
						}
					}
					window.setTimeout(arguments.callee, 0);
				}, 0);
				break;

			default:
				break;
		}
	},
 
	// toolbar 
	toolbarCustomizing : false,
	
	customizeToolbar : function() 
	{
		var cmd = document.getElementById('cmd_CustomizeToolbars');
		cmd.setAttribute('disabled', true);
		this.toolbarCustomizing = true;
		window.openDialog(
			'chrome://global/content/customizeToolbar.xul',
			'CustomizeToolbar',
			'chrome,all,dependent',
			document.getElementById('webmap-toolbox')
		);
	},
	
	toolboxCustomizeDone : function(aToolboxChanged) 
	{
		if (aToolboxChanged) {
			WebMapService.notifyObservers('webmap:toolbar-customized', null);
		}
		var cmd = document.getElementById('cmd_CustomizeToolbars');
		cmd.removeAttribute('disabled');
		this.toolbarCustomizing = false;
	},
   
	// toolbar commands 
	
	openBrowser : function() 
	{
		window.openDialog(this.service.browserURI, '_blank', 'chrome,all,dialog=no');
	},
 
	showConfiguration : function() 
	{
		var dialog = this.service.getTopWindowOf('webmap:configuration');
		if (dialog) {
			dialog.focus();
		}
		else {
			window.openDialog('chrome://webmap/content/pref/prefDialog.xul', '_blank', 'chrome,dialog,modal');
		}
	},
  
	init : function() 
	{
		this.service.nsIObserverService.addObserver(this, 'webmap:service:node-operation', false);
		this.view.content.addEventListener('DOMMouseScroll', this.onMouseScroll, true);

		this.dragNodeScrollListener = {
			commandServer : this,
			view          : this.view,
			onAutoRepeatScroll : function(aScrollInfo)
			{
				var dX = aScrollInfo.x-this.commandServer.draggingStartX;
				var dY = aScrollInfo.y-this.commandServer.draggingStartY;
/*
				this.view.preventRedraw = true;

				for (var i in this.commandServer.draggingNodes)
					this.commandServer.moveNodeTo(
						this.commandServer.draggingNodes[i],
						this.commandServer.draggingNodes[i].x-dX,
						this.commandServer.draggingNodes[i].y-dY
					);

				this.view.preventRedraw = false;
				this.view.redraw();
*/
				this.commandServer.draggingStartX += dX;
				this.commandServer.draggingStartY += dY;
			}
		};

		var toolbox = document.getElementById('webmap-toolbox');
		toolbox.customizeDone = this.toolboxCustomizeDone;
	},
 
	destroy : function() 
	{
		this.service.nsIObserverService.removeObserver(this, 'webmap:service:node-operation');
		this.view.content.removeEventListener('DOMMouseScroll', this.onMouseScroll, true);
	},
 
	toString : function()
	{
		return '[object WebMapCommand]';
	}
}; 
  
