var WebMapView = { 
	cacheVersion : '0.2.2005020701',

	activated : false,

	get gridArray()
	{
		return  [
			this.DOMAIN_SAME,
			this.DOMAIN_SIMILAR,
			this.SIMILAR_CONTENTS,
			this.DOMAIN_FOREIGN,
			this.DOMAIN_UNRELATED
		];
	},

	buildingNodes : {},
	buildingArcs  : {},

	isBuilding : false,

	nodeHelpers : {},
	arcHelpers  : {},

	world  : null,
	worlds : {
		node   : null,
		domain : null
	},

	mapMode : 'all',

	scrollButtons : null,

	viewWidthRevision  : 0,
	viewHeightRevision : 0,

	XULNS : 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul',
	SVGNS : 'http://www.w3.org/2000/svg',
	
	// references 
	
	get service() 
	{
		return window.WebMapService;
	},
 
	get preventRedraw() 
	{
		return this.world.preventRedraw;
	},
	set preventRedraw(val)
	{
		this.world.preventRedraw = val;
		return this.world.preventRedraw;
	},
 
	get content() 
	{
		if (!this._content)
			this._content = document.getElementById('content');
		return this._content;
	},
	_content : null,
 
	get viewDocument() 
	{
		return this.content.contentDocument;
	},
 
	get canvas() 
	{
		return this.viewDocument.getElementById('canvas');
	},
 
	get arcsLayer() 
	{
		return this.world.arcsLayer;
	},
 
	get nodesLayer() 
	{
		return this.world.nodesLayer;
	},
 
	get lastFocusedNode() 
	{
		var node = this.getFocusedNode();
		return node || this.getNode(this._lastFocusedNodeURI) || null ;
	},
	set lastFocusedNode(val)
	{
		if (val)
			this._lastFocusedNodeURI = val.URI;
		return this.lastFocusedNode;
	},
	_lastFocusedNodeURI : null,
 
	get redrawInterval() 
	{
		return Math.max(this.service.getPref('webmap.redraw.interval'), 1);
	},
  
	createNode : function(aInfo) 
	{
		if (!aInfo || (!aInfo.domain && !aInfo.URI)) return;

		var sv = this.service;
		var id = aInfo.URI ? sv.sanitizeURI(aInfo.URI) : aInfo.domain ;

		if (this.checkNodeExists(id)) return;

		var uri = id;
		var ds  = sv.getDataSourceForURI(uri);
		if (!ds) return;

		this.onBuildStart();
		sv.notifyObservers('webmap:view:build', 'node\n'+id);

		this.buildingNodes[id] = true;


		var node = document.createElementNS(this.SVGNS, 'foreignObject');
		node.setAttribute('class',   'webmap-node');
		node.setAttribute('node-id', id);

		node.setAttribute('width', 1);
		node.setAttribute('height', 1);
		/* ↑2004-11-20
			・サイズ指定がないと、SVGのforeignObjectの大きさは内容に応じて
			　広がる。
			・foreignObject要素の内容である他の名前空間の要素は、拡大縮小の
			　影響を受けない。
			・例えば300%に拡大表示した際、XUL要素の大きさは、見かけ上は
			　変わらず、SVGの座標空間上では計算上は1/3になっている。
			・しかしforeignObjectのボックスの大きさは、XUL要素の見かけの
			　大きさではなく100%表示の時の大きさに固定されてしまう。
			　つまり、300%に拡大表示していれば、foreignObjectのボックスは
			　XUL要素のボックスの見かけのサイズの3倍の大きさとなる。

			以上の理由から、拡大表示した際に、何もないところでノードが
			マウスイベントに反応するという問題が起こる。
			この問題は、適当なサイズをSVG要素に指定してやることで回避できる。

			・foreignObjectの中に置かれた他の名前空間の要素は、foreignObjectの
			　ボックスの外にまではみ出して描画される。
			・子要素で発生したイベントは親要素にも伝搬する。無名内容として
			　追加されたXUL要素の上でイベントを起こせば、それらは親要素の
			　foreignObjectに伝わるため、パーザ的には依然として「foreignObjectで
			　イベントが起こった」扱いになる。

			以上の理由から、この対処法でも問題は起こらない。
			ただし、これらの点でSVGの実装が変更された場合、この対処法は意味を
			なさなくなる。

			また、再描画を行うと表示が乱れる問題も起こる。
			（ここで指定した仮のサイズの外側にはみ出した内容が描画されない
			　ことがある）
			これは何故か透明度を指定したXUL要素についてのみ問題が起こらな
			かったので、暫定的に、CSSでopacityを0.999に指定してごまかしている。
			再描画がかかると全体にゆらゆら揺れる感じになるのがちょっと気持ち
			悪いけど、背に腹は代えられません……

			本当なら、拡大・縮小に応じてforeignObjectのボックスの大きさを計算
			して、そのマウスイベントが有効か否かを判断するべきなんだろうけど、
			めんどくさいのでやらない。
		*/

		if (aInfo.selected)         node.setAttribute('node-selected', true);
		if (aInfo.focused)          node.setAttribute('node-focused', true);
		if (aInfo.neighborSelected) node.setAttribute('node-neighbor-selected', true);

		var uriObj = sv.makeURIFromSpec(uri);
		var domain;
		var type = 'page-node';
		if (aInfo.domain) {
			type   = 'domain-node';
			domain = id;
			uri    = 'http://'+id+'/';
		}
		else {
			domain = uriObj.host;
		}
		node.setAttribute('node-type', type);


		var res;
		var img   = '';
		var icon  = '';
		var label = '';
		var maxLength = sv.getPref('webmap.node.label.size');

		var i;
		var x;
		var y;

		if (aInfo.URI) {
			res = sv.nsIRDFService.GetResource(uri);

			switch (sv.getPref('webmap.image.type'))
			{
				case 1: // favicon
					var iconRes = sv.getTarget(ds, res, sv.NS+'AvailableIcon');
					if (iconRes) {
						img = sv.getTargetValue(ds, iconRes, sv.NS+'ImageData');
					}
					else {
						var icons = sv.getTargets(ds, res, sv.kNC_Icon);
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
					if (img && img != 'data:')
						node.setAttribute('image', img);
					break;

				case 2: // thumbnail
					img = sv.getTargetValue(ds, res, sv.NS+'Thumbnail');
					if (img && img != 'data:')
						node.setAttribute('image', img);

					var iconRes = sv.getTarget(ds, res, sv.NS+'AvailableIcon');
					if (iconRes) {
						icon = sv.getTargetValue(ds, iconRes, sv.NS+'ImageData');
					}
					else {
						var icons = sv.getTargets(ds, res, sv.kNC_Icon);
						while (icons.hasMoreElements())
						{
							iconRes = icons.getNext().QueryInterface(Components.interfaces.nsIRDFResource);
							icon = sv.getTargetValue(ds, iconRes, sv.NS+'ImageData');
							if (icon) {
								if (icon != 'data:') {
									sv.setTargetTo(ds, res, sv.NS+'AvailableIcon', iconRes);
								}
								break;
							}
						}
					}
					if (icon && icon != 'data:')
						node.setAttribute('icon', icon);
					break;

				default:
					break;
			}

			label = sv.getLiteralValueFrom(ds, res, sv.kNC_Name) || uri;
			node.setAttribute('label', label);
			node.setAttribute('page',  uri);
			node.setAttribute('displayedLabel', (label.length > maxLength) ? label.substring(0, maxLength)+'...' : label );


			node.setAttribute('path', uriObj.host+uriObj.path.replace(/[\?|\#].+$/, '').replace(/[^\/]+$/, ''));

			node.setAttribute('domain'+this.DOMAIN_SAME,    domain);
			node.setAttribute('domain'+this.DOMAIN_SIMILAR, sv.getParentDomain(domain));

			x = sv.getLiteralValueFrom(ds, res, sv.NS+'X');
			y = sv.getLiteralValueFrom(ds, res, sv.NS+'Y');
			if (
				(x === null && y === null) ||
				('autoPosition' in aInfo && aInfo.autoPosition)
				) {
				aInfo.fromURI   = aInfo.baseNode ? aInfo.baseNode.URI : null ;
				aInfo.targetURI = uri;
				this.findBlankPoint(aInfo);
				x = aInfo.x;
				y = aInfo.y;
			}
			else {
				x = ('x' in aInfo) ? aInfo.x : Number(x || 0) ;
				y = ('y' in aInfo) ? aInfo.y : Number(y || 0) ;
			}
			sv.setLiteralValueTo(ds, res, sv.NS+'X', x);
			sv.setLiteralValueTo(ds, res, sv.NS+'Y', y);

			node.setAttribute('x', x);
			node.setAttribute('y', y);


			var domainNode = this.getNode(domain);
			if (domainNode) {
				domainNode.totalX += x;
				domainNode.totalY += y;
			}


			var grid,
				gridPosition;
			var array = this.gridArray;
			for (i = 0; i < array.length; i++)
			{
				grid         = this.getGrid(array[i]);
				gridPosition = Math.ceil(x/grid)+':'+Math.ceil(y/grid);
				this.gridInfo[array[i]][gridPosition] = true;
				node.setAttribute('gridPosition'+array[i], gridPosition);
			}


			this.worlds.all.nodesLayer.appendChild(node);
			node = null;
			return;
		}
		else {
			res = sv.nsIRDFService.GetResource(sv.NS+'urn:webmap:nodes:'+encodeURIComponent(domain));

			var topPage = this.viewDocument.getElementsByAttribute('path', domain+'/');
			if (topPage.length) {
				lable = topPage[0].label;
				img   = topPage[0].image;
				icon  = topPage[0].icon;
			}



			x = ('x' in aInfo) ? aInfo.x : sv.getLiteralValueFrom(ds, res, sv.NS+'X') ;
			y = ('y' in aInfo) ? aInfo.y : sv.getLiteralValueFrom(ds, res, sv.NS+'Y') ;

			var totalX = ('totalX' in aInfo) ? aInfo.totalX : sv.getLiteralValueFrom(ds, res, sv.NS+'TotalX') ;
			var totalY = ('totalY' in aInfo) ? aInfo.totalY : sv.getLiteralValueFrom(ds, res, sv.NS+'TotalY') ;

			if (
				x      === null ||
				y      === null ||
				totalX === null ||
				totalY === null
				) {
				totalX = 0;
				totalY = 0;

				var nodes = this.viewDocument.getElementsByAttribute('domain'+this.DOMAIN_SAME, domain);
				for (i = 0; i < nodes.length; i++)
				{
					if (!img &&
						nodes[i].getAttribute('image') &&
						nodes[i].getAttribute('image') != 'data:')
						img = nodes[i].getAttribute('image');

					if (!icon &&
						nodes[i].getAttribute('icon') &&
						nodes[i].getAttribute('icon') != 'data:')
						icon = nodes[i].getAttribute('icon');

					if (!label &&
						nodes[i].getAttribute('label'))
						label = nodes[i].getAttribute('label');

					totalX += Number(nodes[i].getAttribute('x') || 0);
					totalY += Number(nodes[i].getAttribute('y') || 0);
				}

				x = totalX/nodes.length;
				y = totalY/nodes.length;

//				sv.setLiteralValueTo(ds, res, sv.NS+'X', x);
//				sv.setLiteralValueTo(ds, res, sv.NS+'Y', y);
//				sv.setLiteralValueTo(ds, res, sv.NS+'TotalX', totalX);
//				sv.setLiteralValueTo(ds, res, sv.NS+'TotalY', totalY);
			}
			else {
				x      = Number(x);
				y      = Number(y);
				totalX = Number(totalX);
				totalY = Number(totalY);
			}

			node.setAttribute('x',      x);
			node.setAttribute('y',      y);
			node.setAttribute('totalX', totalX);
			node.setAttribute('totalY', totalY);

			if (img && img != 'data:')
				node.setAttribute('image', img);
			if (icon && icon != 'data:')
				node.setAttribute('icon', icon);

			label = label || domain;
			node.setAttribute('label',  label);
			node.setAttribute('domain', domain);
			node.setAttribute('count',  Number(sv.getLiteralValueFrom(ds, res, sv.NS+'Count')));
			node.setAttribute('displayedLabel', (label.length > maxLength) ? label.substring(0, maxLength)+'...' : label );


			this.worlds.domain.nodesLayer.appendChild(node);
			node = null;
			return;
		}
	},
	
	removeNode : function(aNode) 
	{
		if (!aNode || !aNode.parentNode) return;

		this.service.notifyObservers('webmap:view:node-operation:'+aNode.id, 'unregister');

		if (aNode.type != 'domain-node') {
			var domain = aNode.domain;
			var domainNode = this.getNode(domain);
			var nodes;
			if (domainNode) nodes = domainNode.nodes;
			if (nodes && !nodes.length)
				this.removeNode(this.getNode(domain));
			else
				this.updateDomainNodeFor(aNode);
		}

		this.unregisterNode(aNode);
	},
  
	updateNode : function(aNode) 
	{
		var info = {
			focused          : aNode.focused,
			selected         : aNode.selected,
			neighborSelected : aNode.neighborSelected,
			x                : aNode.x,
			y                : aNode.y
		};
		if (aNode.type == 'domain-node') {
			info.domain = aNode.domain;
			info.totalX = aNode.totalX;
			info.totalY = aNode.totalY;
		}
		else {
			info.URI    = aNode.URI;
			var domainNode = this.getNode(aNode.domain);
			if (domainNode) {
				domainNode.totalX -= info.x;
				domainNode.totalY -= info.y;
			}
		}

		this.unregisterNode(aNode);
		this.createNode(info);
	},
 
	createArc : function(aInfo) 
	{
		if (!aInfo || !aInfo.fromURI || !aInfo.targetURI) return;

		var sv = this.service;
		var fromURI   = aInfo.domain ? aInfo.fromURI : sv.sanitizeURI(aInfo.fromURI) ;
		var targetURI = aInfo.domain ? aInfo.targetURI : sv.sanitizeURI(aInfo.targetURI) ;
		var id = encodeURIComponent(fromURI)+':'+encodeURIComponent(targetURI);

		if (this.checkArcExists(id)) return;

		this.onBuildStart();
		sv.notifyObservers('webmap:view:build', 'arc\n'+fromURI+'\n'+targetURI);

		this.buildingArcs[id] = true;


		var node = document.createElementNS(this.SVGNS, 'g');
		node.setAttribute('class', 'webmap-arc');
		node.setAttribute('arc-id', id);

		node.setAttribute('fromURI',   fromURI);
		node.setAttribute('targetURI', targetURI);

		node.setAttribute('arc-building', true);

		if (aInfo.domain)
			this.worlds.domain.arcsLayer.appendChild(node);
		else
			this.worlds.all.arcsLayer.appendChild(node);
	},
	
	removeArc : function(aArc) 
	{
		this.unregisterArc(aArc);
	},
  
	// manage nodes and arcs 
	
	// node 
	
	getNode : function(aURI) 
	{
		var nodes = this.viewDocument.getElementsByAttribute('node-id', this.service.sanitizeURI(aURI));
		return nodes.length ? nodes[0] : null ;
	},
 
	hasNodes : function() 
	{
		return this.worlds.all.node.lastChild.hasChildNodes();
	},
 
	checkNodeExists : function(aURI) 
	{
		aURI = this.service.sanitizeURI(aURI);
		return this.getNode(aURI) ||
				(aURI in this.buildingNodes && this.buildingNodes[aURI]);
	},
 
	isNodeVisible : function(aNode) 
	{
		if (!aNode) return false;

		var width  = aNode.width/(Math.max(this.world.scale, 1)/100);
		var height = aNode.height/(Math.max(this.world.scale, 1)/100);

		return !(
			aNode.x        < this.world.viewPortX ||
			aNode.x+width  > this.world.viewPortX+this.world.viewPortWidth ||
			aNode.y        < this.world.viewPortY ||
			aNode.y+height > this.world.viewPortY+this.world.viewPortHeight
		);
	},
 
	registerNode : function(aNode) 
	{
		if (!aNode) return;

		if (aNode.id in this.buildingNodes)
			delete this.buildingNodes[aNode.id];

		window.setTimeout(function() {
			if (aNode.type == 'domain-node') {
				WebMapView.updateDomainArcsFor(aNode);
			}
			else {
				var ds = WebMapService.getDataSourceForURI(aNode.URI);
				if (ds)
					WebMapView.updateArcsFor(aNode, ds);
				WebMapView.updateDomainNodeFor(aNode);
			}
			aNode.redraw();
			WebMapView.onBuildEnd();
		}, 0);
	},
	
	updateArcsFor : function(aNode, aDataSource) 
	{
		try {
			var sv = this.service;

			var arcsRes = sv.nsIRDFService.GetResource(sv.NS+'urn:webmap:arcs:'+encodeURIComponent(aNode.id));

			var arcs = Components.classes['@mozilla.org/rdf/container;1'].createInstance(Components.interfaces.nsIRDFContainer);
			arcs.Init(aDataSource, arcsRes);

			var autolink = this.service.getPref('webmap.autolink.samedomain');

			var arcsEnum = arcs.GetElements();
			var arcRes,
				arcID,
				arc,
				newArcs       = [],
				buildingArcs  = [],
				array,
				fromURI,
				fromDS,
				targetURI;
			while (arcsEnum.hasMoreElements())
			{
				arcRes = arcsEnum.getNext().QueryInterface(Components.interfaces.nsIRDFResource);

				arcID     = arcRes.Value.replace(/[^#]+#urn:webmap:arc:/, '');
				array     = arcID.split(':');
				fromURI   = decodeURIComponent(array[0]);
				targetURI = decodeURIComponent(array[1]);

				fromDS = this.service.getDataSourceForURI(fromURI);
				if (
					!autolink &&
					(
						!fromDS ||
						this.service.getTargetValue(
							fromDS,
							arcRes,
							this.service.NS+'ArcType'
						) != this.service.NS+'Link'
					)
					)
					continue;

				arc = this.getArcById(arcID);

				if (!arc) {
					if (this.checkArcExists(arcID)) {
						buildingArcs.push(arcID);
						continue;
					}

					if (
						!this.getNode(fromURI) ||
						!this.getNode(targetURI) ||
						fromURI == targetURI
						)
						continue;

					this.createArc({
						fromURI   : fromURI,
						targetURI : targetURI
					});
					newArcs.push(arcID);
				}

				if (!(arcID in aNode.arcs))
					aNode.arcs.length++;

				aNode.arcs[arcID] = arc;

				if (arc) {
					arc.updateStatus();
				}
			}

			window.setTimeout(function() {
				var i;
				var arc;
				if (newArcs.length || buildingArcs.length) {
					for (i in buildingArcs)
					{
						arc = WebMapView.getArcById(buildingArcs[i]);
						if (arc) {
							if (!(buildingArcs[i] in aNode.arcs))
								aNode.arcs.length++;
							aNode.arcs[buildingArcs[i]] = arc;
						}
					}
				}

				WebMapService.notifyObservers('webmap:view:arc-operation:'+aNode.id, 'redraw');

				if (newArcs.length)
					WebMapView.updateDomainNodeFor(aNode);

				WebMapView.redraw();
			}, 0);
		}
		catch(e) {
		}
	},
  
	unregisterNode : function(aNode, aDoCompletely) 
	{
		if (!aNode || !aNode.parentNode) return;

		aNode.focused  = false;
		aNode.selected = false;

		var domain = aNode.domain;

		var preventRedraw = false;
		if (!this.preventRedraw) {
			this.preventRedraw = true;
			preventRedraw = true;
		}

		if (preventRedraw)
			this.preventRedraw = false;

		delete this.buildingNodes[aNode.id];
		delete this.nodeHelpers[aNode.id];

		aNode.parentNode.removeChild(aNode);

		aNode = null;

		this.redraw();
	},
 
	updateDomainNodeFor : function(aNode) 
	{
		var domainNode = this.getNode(aNode.domain);
		if (!domainNode) {
			if (!(aNode.domain in this.buildingNodes)) {
				this.createNode({ domain : aNode.domain });
			}
		}
		else {
			if (domainNode.nodes.length != domainNode.count) {
				// remove and recreate, because the view area will be broken if we change the attribute of the node directly.
				this.updateNode(domainNode);
/*
				var info = {
						domain           : aNode.domain,
						selected         : domainNode.selected,
						focused          : domainNode.focused,
						neighborSelected : domainNode.neighborSelected
					};
				this.removeNode(domainNode);
				this.createNode(info);
*/
			}
			else {
				window.setTimeout(function() {
					WebMapView.updateDomainArcsFor(domainNode);
					domainNode.updateDomainPosition();
					domainNode = null;
				}, 0);
			}
		}
	},
	
	updateDomainArcsFor : function(aNode) 
	{
		if (!aNode) return;

		var sv = this.service;
		var ds = sv.getDataSourceForURI(aNode.URI);
		if (!ds) return;

		var arcs = ds.GetSources(
				sv.nsIRDFService.GetResource(sv.NS+'ForeignDomain'),
				sv.nsIRDFService.GetLiteral('true'),
				true
			);

		var arcRes,
			arcID,
			array,
			host,
			fromHost,
			targetHost,
			arc,
			buildingArcs = [],
			newArcs      = [];
		while (arcs.hasMoreElements())
		{
			arcRes = arcs.getNext().QueryInterface(Components.interfaces.nsIRDFResource);

			arcID      = arcRes.Value.replace(/[^#]+#urn:webmap:arc:/, '');
			array      = arcID.split(':');
			fromHost   = sv.makeURIFromSpec(decodeURIComponent(array[0])).host;
			targetHost = sv.makeURIFromSpec(decodeURIComponent(array[1])).host;

			if (fromHost != aNode.domain)
				host = fromHost;
			else if (targetHost != aNode.domain)
				host = targetHost;
			else
				continue;

			if (!this.getNode(host)) continue;

			arcID = encodeURIComponent(fromHost)+':'+encodeURIComponent(targetHost);
			arc = this.getArcById(arcID);

			if (!arc) {
				if (this.checkArcExists(arcID)) {
					buildingArcs.push(arcID);
					continue;
				}

				this.createArc({
					fromURI   : fromHost,
					targetURI : targetHost,
					domain    : aNode.domain
				});
				newArcs.push(arcID);
			}

			if (!(arcID in aNode.arcs))
				aNode.arcs.length++;

			aNode.arcs[arcID] = arc;

			if (arc) {
				arc.updateStatus();
			}
		}


		window.setTimeout(function() {
			var i;
			var arc;
			if (newArcs.length || buildingArcs.length) {
				for (i in buildingArcs)
				{
					arc = WebMapView.getArcById(buildingArcs[i]);
					if (arc) {
						if (!(buildingArcs[i] in aNode.arcs))
							aNode.arcs.length++;
						aNode.arcs[buildingArcs[i]] = arc;
					}
				}
			}

			WebMapService.notifyObservers('webmap:view:arc-operation:'+aNode.id, 'redraw');

			WebMapView.redraw();
		}, 0);
	},
   
	// arc 
	
	getArcById : function(aID) 
	{
		var nodes = this.viewDocument.getElementsByAttribute('arc-id', aID);
		var arc = nodes.length ? nodes[0] : null ;
		if (!arc) {
			aID = aID.split(':');
			nodes = this.viewDocument.getElementsByAttribute('arc-id', aID[1]+':'+aID[0]);
			arc = nodes.length ? nodes[0] : null ;
		}
		return arc;
	},
 
	checkArcExists : function(aID) 
	{
		if (this.getArcById(aID)) return true;
		if ((aID in this.buildingArcs && this.buildingArcs[aID])) return true;

		aID = aID.split(':');
		aID = aID[1]+':'+aID[0];
		return (aID in this.buildingArcs && this.buildingArcs[aID]);
	},
 
	registerArc : function(aArc) 
	{
		if (!aArc) return;

		if (aArc.id in this.buildingArcs)
			delete this.buildingArcs[aArc.id];

		if (aArc.fromNode && !aArc.fromNode.arcs[aArc.id]) {
			if (!(aArc.id in aArc.fromNode.arcs))
				aArc.fromNode.arcs.length++;
			aArc.fromNode.arcs[aArc.id] = aArc;
		}

		if (aArc.targetNode && !aArc.targetNode.arcs[aArc.id]) {
			if (!(aArc.id in aArc.targetNode.arcs))
				aArc.targetNode.arcs.length++;
			aArc.targetNode.arcs[aArc.id] = aArc;
		}

		this.onBuildEnd();

		aArc.redraw();
	},
 
	unregisterArc : function(aArc) 
	{
		if (!aArc || !aArc.parentNode) return;

		if (aArc.fromNode) {
			if (aArc.id in aArc.fromNode.arcs)
				aArc.fromNode.arcs.length--;
			delete aArc.fromNode.arcs[aArc.id];
		}
		if (aArc.targetNode) {
			if (aArc.id in aArc.targetNode.arcs)
				aArc.targetNode.arcs.length--;
			delete aArc.targetNode.arcs[aArc.id];
		}

		delete this.buildingArcs[aArc.id];
		delete this.arcHelpers[aArc.id];

		aArc.parentNode.removeChild(aArc);

		aArc = null;

		this.redraw();
	},
  
	getSelectedNodes : function() 
	{
		return this.viewDocument.getElementsByAttribute('node-selected', 'true');
	},
	
	clearSelection : function() 
	{
		this.service.notifyObservers('webmap:view:node-operation:all', 'unselect');
	},
  
	getFocusedNode : function() 
	{
		var nodes = this.getFocusedNodes();
		return nodes.length ? nodes[0] : null ;
	},
	
	getFocusedNodes : function() 
	{
		return this.viewDocument.getElementsByAttribute('node-focused', 'true');
	},
 
	clearFocus : function() 
	{
		this.service.notifyObservers('webmap:view:node-operation:all', 'clear-focus');
	},
  
	getNeighborNodesOf : function(aNode) 
	{
		var nodes = [];
		for (var i in aNode.arcs)
			if (i != 'length')
				nodes.push(aNode.arcs[i].getAnchorFrom(aNode));
		return nodes;
	},
 
	clearArcMarker : function() 
	{
		this.hideArcMarkerImage();
		this.service.notifyObservers('webmap:view:arc-operation:all', 'clear-focus');
	},
  
	// grid 
	DOMAIN_SAME      : 10,
	DOMAIN_SIMILAR   : 20,
	SIMILAR_CONTENTS : 30,
	DOMAIN_FOREIGN   : 40,
	DOMAIN_UNRELATED : 50,
	
	gridInfo : [], 
 
	getGrid : function(aLevel) 
	{
		return Math.max(this.service.getPref('webmap.auto_position.grid.'+aLevel), 1);
	},
 
	findBlankPoint : function(aInfo) 
	{
		/*
			既存ノードと重ならない位置に新しいノードを自動配置する
			ための処理。
			グリッド単位で走査して空きグリッドを探す。

			1. 基準となるノードの中央の座標(startX, startY)を取得。
			   ノードがなければ基準点を画面中央に設定。
			2. 基準点から一定距離（グリッドの大きさ）だけ離れた円周上の
			   適当な位置に開始点(newBaseX, newBaseY)を設定。
			3. 開始点から左右どちらかの方向にランダムに円周上を移動。
			4. 回転後の座標(newX, newY)の含まれるグリッドに
			   ノードがあるかどうかをチェック。
			5. 一周しても空きグリッドが見つからない場合、基準点からの
			   距離を2倍にして、再び円周上を走査。
			6. これでもまだ見つからなければ、基準点からの距離を3倍に……

			という要領で配置位置を決定する。
			基準点からの距離は、繰り返し回数に単純に比例する。
		*/
		this.findBaseNode(aInfo);

		var baseNode    = aInfo.baseNode;
		var grid        = this.getGrid(aInfo.level);
		var gridInfo    = this.gridInfo[aInfo.level];
		var rotateStep  = Math.max(Math.abs(this.service.getPref('webmap.auto_position.rotate')), 1);
		var rotateSteps = 360/rotateStep;

		var startX   = baseNode ? baseNode.x : void(0) ;
		if (startX === void(0))
			startX = (this.world.viewWidth/2)-this.world.x;
		var startY   = baseNode ? baseNode.y : void(0) ;
		if (startY === void(0))
			startY = (this.world.viewHeight/2)-this.world.y;

		var newBaseR = Math.floor(Math.random()*360);
		var r        = (newBaseR*Math.PI/180);
		var newBaseX = (grid*Math.cos(r))-(grid*Math.sin(r));
		var newBaseY = (grid*Math.sin(r))+(grid*Math.cos(r));

		var power    = 1;
		var step     = 1;
		var rotation = 0;
		var newX     = 0;
		var newY     = 0;
		var girdX, gridY;
		var gridPosition;


		// 関係の薄いノードはバラバラに・遠くに配置する
		if (aInfo.level == this.DOMAIN_FOREIGN ||
			aInfo.level == this.DOMAIN_UNRELATED) {
			power = Math.floor(Math.random() * 3);
			step  = Math.floor(Math.random() * 3);
		}


		/* gridX%2, gridY%2に対応した、走査するべき隣のグリッドの位置 */
		var matrix = [
				[
					[
						                   [1,  0],
						          [0,  1], [1,  1]
					],
					[
						          [0, -1], [1, -1],
						                   [1,  0]
					]
				],
				[
					[
						[-1,  0],
						[-1,  1], [0,  1]
					],
					[
						[-1, -1], [0, -1],
						[-1,  0]
					]
				]
			];

		findBlankGrid:
		while (true)
		{
			if (rotation >= 360 || rotation < -360) {
				power += step;
				rotation   = 0;
				rotateStep = -rotateStep;
				newBaseR   = Math.floor(Math.random()*360);
				r          = (newBaseR*Math.PI/180);
				newBaseX   = (grid*power*Math.cos(r))-(grid*power*Math.sin(r));
				newBaseY   = (grid*power*Math.sin(r))+(grid*power*Math.cos(r));
			}

			r    = (newBaseR+rotation*Math.PI/180);
			newX = (newBaseX*Math.cos(r))-(newBaseY*Math.sin(r))+startX;
			newY = (newBaseX*Math.sin(r))+(newBaseY*Math.cos(r))+startY;
			rotation += rotateStep;

			gridX = Math.ceil(newX/grid);
			gridY = Math.ceil(newY/grid);
			gridPosition = gridX+':'+gridY;

			// 同じグリッドにノードがある場合、走査を続行
			if (this.getNodesInGrid(aInfo.level, gridX, gridY).length ||
				(gridPosition in gridInfo && gridInfo[gridPosition]))
				continue;


			/*
				周囲にグリッド幅よりも近い距離のノードがある場合、
				走査を続行する。

				処理を高速化するために、現在のグリッド内での位置を元に、
				グリッド幅よりも近い距離のノードがいる確率の高いグリッド
				のみを調べる。
				┌───┬───┬───┐
				│A     │A/B   │B     │
				│      │      │      │
				│      │      │      │
				├───┼─┬─┼───┤
				│A/C   │A │B │B/D   │
				│      ├─┼─┤      │
				│      │C │D │      │
				├───┼─┴─┼───┤
				│C     │C/D   │D     │
				│      │      │      │
				│      │      │      │
				└───┴───┴───┘
				現在のグリッドをさらに4分割した時に、ABCDどの位置に
				ノードが置かれるのかを判断し、対応したグリッドのみ調査する。
			*/
			var i, j, nodes;
			var scanningMatrix = matrix[Math.ceil(Math.abs(newX/(grid/2))) % 2][Math.ceil(Math.abs(newY/(grid/2))) % 2];
			for (i = 0; i < scanningMatrix.length; i++)
			{
				nodes = this.getNodesInGrid(
							aInfo.level,
							gridX+scanningMatrix[i][0],
							gridY+scanningMatrix[i][1]
						);
				for (j = 0; j < nodes.length; j++)
				{
if (this.service.debug) dump('DISTANCE: '+Math.sqrt((newX-nodes[j].x)*(newX-nodes[j].x) + (newY-nodes[j].y)*(newY-nodes[j].y))+'\n');
					if (nodes[j] != baseNode &&
						Math.sqrt((newX-nodes[j].x)*(newX-nodes[j].x) + (newY-nodes[j].y)*(newY-nodes[j].y)) < grid)
						continue findBlankGrid;
				}
			}

			aInfo.x = newX;
			aInfo.y = newY;

			break;
		}
	},
	
	findBaseNode : function(aInfo) 
	{
		var level  = this.DOMAIN_SAME;
		var domain = this.service.makeURIFromSpec(aInfo.targetURI).host;

		//  * 渡された基準ノードが異なるドメイン
		//  * 同一ドメインのノードが既に存在する
		// この場合、渡された基準ノードを無視して同一ドメインのノードの付近に配置

		var base = aInfo.baseNode || null;

		var newBaseNode;
		if (
			domain &&
			(!base || base.domain != domain)
			) {
			// level 0
			var domainNode = this.getNode(domain);
			var nodes = domainNode ? domainNode.nodes : null ;
			if (nodes && nodes.length) {
				newBaseNode = nodes[0];
			}
			else { // level 1
				var domain2 = this.service.getParentDomain(domain);
				var nodes = this.viewDocument.getElementsByAttribute('domain'+this.DOMAIN_SIMILAR, domain2);
				if (nodes && nodes.length) {
					newBaseNode = nodes[0];
					level       = this.DOMAIN_SIMILAR;
				}
			}
		}

		if (newBaseNode) {
			base = newBaseNode;
		}
		else if (!aInfo.fromURI) { // level 3
			level = this.DOMAIN_UNRELATED;
		}
		else { // level 2
			try {
				if (!domain ||
					!aInfo.fromURI ||
					this.service.makeURIFromSpec(aInfo.fromURI).host != domain) {
					level = this.DOMAIN_FOREIGN;
				}
			}
			catch(e) {
			}
		}

		aInfo.baseNode = base ||
						this.lastFocusedNode ||
						this.world.nodesLayer.lastChild;
		aInfo.level    = level;
	},
  
	getNodesInGrid : function(aLevel, aX, aY) 
	{
		var pos = aX+':'+aY;
		var nodes = this.viewDocument.getElementsByAttribute('gridPosition'+aLevel, pos);
		return nodes;
	},
  
	// world 
	
	scrollToNode : function(aNode) 
	{
		if (this.scrollToNodeTimer) {
			window.clearInterval(this.scrollToNodeTimer);
			this.scrollToNodeTimer = null;
		}

		this.clearArcMarker();

		this.canvas.setAttribute('panning', true);

		var info = {
			startX : this.world.x,
			startY : this.world.y,
			endX   : -(aNode.x*(this.world.scale/100))
						+parseInt(this.world.viewWidth/2)
						-(aNode.width/2),
			endY   : -(aNode.y*(this.world.scale/100))
						+parseInt(this.world.viewHeight/2)
						-(aNode.height/2),
			count  : 0,
			steps  : Math.max(this.service.getPref('webmap.world.scroll.steps'), 1),
			view   : this
		};
		this.scrollToNodeTimer = window.setInterval(this.scrollToNodeCallback, 50, info);
	},
	scrollToNodeTimer : null,
	scrollToNodeCallback : function(aInfo)
	{
		if (aInfo.count >= aInfo.steps) {
			window.clearInterval(aInfo.view.scrollToNodeTimer);
			aInfo.view.scrollToNodeTimer = null;
			aInfo.view.canvas.removeAttribute('panning');
			return;
		}
		aInfo.count++;
		aInfo.view.pan(
			aInfo.startX+(((aInfo.endX-aInfo.startX)/aInfo.steps)*aInfo.count),
			aInfo.startY+(((aInfo.endY-aInfo.startY)/aInfo.steps)*aInfo.count)
		);

//		aInfo.redraw();
	},
 
	pan : function(aX, aY) 
	{
		if (this.panTimer) {
			window.clearTimeout(this.panTimer);
			this.panTimer = null;
		}

		this.clearArcMarker();

		this.worlds.all.x = aX;
		this.worlds.all.y = aY;
		this.worlds.domain.x = aX;
		this.worlds.domain.y = aY;

		this.service.notifyObservers('webmap:world-moved', aX+'\n'+aY);

		this.panTimer = window.setTimeout(this.panCallback, this.redrawInterval);
	},
	panTimer : null,
	panCallback : function()
	{
		WebMapView.redraw();
		WebMapView.panTimer = null;
	},
 
	zoom : function(aValue) 
	{
		var newScale = Math.min(
						Math.max(
							aValue,
							this.service.getPref('webmap.world.scale.min')
						),
						this.service.getPref('webmap.world.scale.max')
					);
		if (newScale == this.world.scale) return;


		if (this.zoomTimer) {
			window.clearInterval(this.zoomTimer);
			this.zoomTimer = null;
		}


		this.clearArcMarker();

		var w = this.worlds.all;
		this.preventRedraw = true;

		var autoToggle        = this.service.getPref('webmap.world.mode.auto_change');
		var toggleToAllMode   = aValue >= this.service.getPref('webmap.world.mode.auto_change.scale');
		var shouldToggleAfter = w.scale <= aValue;

		if (autoToggle &&
			!shouldToggleAfter &&
			shouldToggleAfter == toggleToAllMode)
			this.toggleMapMode(toggleToAllMode);

		w.x = -((w.viewPortX+(w.viewPortWidth/2))*(Math.max(aValue, 1)/100))
				+parseInt(w.viewWidth/2);
		w.y = -((w.viewPortY+(w.viewPortHeight/2))*(Math.max(aValue, 1)/100))
				+parseInt(w.viewHeight/2);

		w.scale = aValue;
		this.service.setPref('webmap.world.scale', w.scale);

		this.service.notifyObservers('webmap:world-zoomed', w.scale);

		this.worlds.domain.x     = w.x;
		this.worlds.domain.y     = w.y;
		this.worlds.domain.scale = w.scale;

		if (autoToggle &&
			shouldToggleAfter &&
			shouldToggleAfter == toggleToAllMode)
			this.toggleMapMode(toggleToAllMode);

		this.preventRedraw = false;

		this.zoomTimer = window.setTimeout(this.zoomCallback, this.redrawInterval);
	},
	zoomTimer : null,
	zoomCallback : function()
	{
		WebMapView.redraw(true);
		WebMapView.zoomTimer = null;
	},
	
	zoomIn : function(aPower) 
	{
		var step = Math.abs(this.service.getPref('webmap.world.scale.step'));
		var power = aPower || Math.abs(Number(this.service.getPref('webmap.world.scale.zoomInOut.power') || 0));

		var newScale = this.world.scale*power;
		if (Math.abs(newScale-this.world.scale) < step) step = 1;

		this.zoom(Math.round(newScale/step)*step);
	},
 
	zoomOut : function(aPower) 
	{
		var step = Math.abs(this.service.getPref('webmap.world.scale.step'));
		var power = aPower || Math.abs(Number(this.service.getPref('webmap.world.scale.zoomInOut.power') || 0));

		var newScale = this.world.scale/power;
		if (Math.abs(newScale-this.world.scale) < step) step = 1;

		this.zoom(Math.round(newScale/step)*step);
	},
  
/*	rotate : function(aValue) 
	{
		this.world.rotation = aValue;
		this.service.setPref('webmap.world.rotation', this.world.rotation);
	},*/
 
	toggleMapMode : function(aEnterToDetailedMap) 
	{
		var mode = (aEnterToDetailedMap !== void(0)) ?
					(aEnterToDetailedMap ? 'all' : 'domain' ) :
					(this.service.getPref('webmap.world.mode') == 'all' ? 'domain' : 'all' );
		if (this.canvas.getAttribute('mapmode') != mode) {
			this.canvas.setAttribute('mapmode', mode);
			this.service.setPref('webmap.world.mode', mode);

			this.worlds.all.active    = (mode == 'all');
			this.worlds.domain.active = (mode == 'domain');

			this.mapMode = mode;

			this.service.notifyObservers('webmap:view:state', 'map-mode\n'+mode);
		}
	},
  
	// scroll buttons 
	preventShowHideScrollButtons : false,
	
	initScrollButtons : function() 
	{
		var sv = WebMapService;

		var offset       = sv.getPref('webmap.world.scroll.button.offset');
		var offsetCorner = sv.getPref('webmap.world.scroll.button.offset.corner');

		var corner = Math.sin(45*Math.PI/180);

		this.scrollButtons = {
			up    : new WebMapScrollButton(
						this.viewDocument.getElementById('scroll-button-up'),
						function() {
							return {
								x : WebMapView.world.viewWidth/2,
								y : offset
							};
						},
						function(aValue) {
							return {
								x : WebMapView.world.x,
								y : WebMapView.world.y+aValue
							};
						}
					),
			right : new WebMapScrollButton(
						this.viewDocument.getElementById('scroll-button-right'),
						function() {
							return {
								x : WebMapView.world.viewWidth-offset,
								y : WebMapView.world.viewHeight/2
							};
						},
						function(aValue) {
							return {
								x : WebMapView.world.x-aValue,
								y : WebMapView.world.y
							};
						}
					),
			down   : new WebMapScrollButton(
						this.viewDocument.getElementById('scroll-button-down'),
						function() {
							return {
								x : WebMapView.world.viewWidth/2,
								y : WebMapView.world.viewHeight-offset
							};
						},
						function(aValue) {
							return {
								x : WebMapView.world.x,
								y : WebMapView.world.y-aValue
							};
						}
					),
			left   : new WebMapScrollButton(
						this.viewDocument.getElementById('scroll-button-left'),
						function() {
							return {
								x : offset,
								y : WebMapView.world.viewHeight/2
							};
						},
						function(aValue) {
							return {
								x : WebMapView.world.x+aValue,
								y : WebMapView.world.y
							};
						}
					),

			upright : new WebMapScrollButton(
						this.viewDocument.getElementById('scroll-button-upright'),
						function() {
							return {
								x : WebMapView.world.viewWidth-offsetCorner,
								y : offsetCorner
							};
						},
						function(aValue) {
							return {
								x : WebMapView.world.x-(aValue/corner),
								y : WebMapView.world.y+(aValue/corner)
							};
						}
					),
			upleft  : new WebMapScrollButton(
						this.viewDocument.getElementById('scroll-button-upleft'),
						function() {
							return {
								x : offsetCorner,
								y : offsetCorner
							};
						},
						function(aValue) {
							return {
								x : WebMapView.world.x+(aValue/corner),
								y : WebMapView.world.y+(aValue/corner)
							};
						}
					),
			downright : new WebMapScrollButton(
						this.viewDocument.getElementById('scroll-button-downright'),
						function() {
							return {
								x : WebMapView.world.viewWidth-offsetCorner,
								y : WebMapView.world.viewHeight-offsetCorner
							};
						},
						function(aValue) {
							return {
								x : WebMapView.world.x-(aValue/corner),
								y : WebMapView.world.y-(aValue/corner)
							};
						}
					),
			downleft : new WebMapScrollButton(
						this.viewDocument.getElementById('scroll-button-downleft'),
						function() {
							return {
								x : offsetCorner,
								y : WebMapView.world.viewHeight-offsetCorner
							};
						},
						function(aValue) {
							return {
								x : WebMapView.world.x+(aValue/corner),
								y : WebMapView.world.y-(aValue/corner)
							};
						}
					)
		};

		if (sv.getPref('webmap.world.scroll.button.autohide'))
			this.hideScrollButtons(true);
	},
 
	showScrollButtons : function(aJustNow) 
	{
		if (this.hideScrollButtonsTimer) {
			window.clearTimeout(this.hideScrollButtonsTimer);
			this.hideScrollButtonsTimer = null;
		}
		if (!this.showScrollButtonsTimer && !this.preventShowHideScrollButtons) {
			if (!aJustNow)
				this.showScrollButtonsTimer = window.setTimeout(this.showScrollButtonsCallback, WebMapService.getPref('webmap.world.scroll.button.autohide.delay'));
			else
				this.showScrollButtonsCallback();
		}
	},
	showScrollButtonsTimer : null,
	showScrollButtonsCallback : function()
	{
		WebMapView.world.canvas.setAttribute('scroll-buttons-active', true);
	},
 
	hideScrollButtons : function(aJustNow) 
	{
		if (this.showScrollButtonsTimer) {
			window.clearTimeout(this.showScrollButtonsTimer);
			this.showScrollButtonsTimer = null;
		}
		if (!this.hideScrollButtonsTimer && !this.preventShowHideScrollButtons) {
			if (!aJustNow)
				this.hideScrollButtonsTimer = window.setTimeout(this.hideScrollButtonsCallback, WebMapService.getPref('webmap.world.scroll.button.autohide.delay'));
			else
				this.hideScrollButtonsCallback();
		}
	},
	hideScrollButtonsTimer : null,
	hideScrollButtonsCallback : function(aWorld)
	{
		WebMapView.world.canvas.removeAttribute('scroll-buttons-active');
	},
  
	// arc markers 
	
	get arcMarkerImage() 
	{
		if (!this.mArcMarkerImage)
			this.mArcMarkerImage = this.viewDocument.getElementById('arc-marker-image');
		return this.mArcMarkerImage;
	},
	mArcMarkerImage : null,
 
	showArcMarkerImage : function(aArc, aX, aY) 
	{
		this.hideArcMarkerImage();

		var fromNodeIsVisible   = this.isNodeVisible(aArc.fromNode);
		var targetNodeIsVisible = this.isNodeVisible(aArc.targetNode);
		if (fromNodeIsVisible && targetNodeIsVisible) return;

		if ((!fromNodeIsVisible && !targetNodeIsVisible) ||
			fromNodeIsVisible)
			this.arcMarkerImage.node  = aArc.targetNode;
		else
			this.arcMarkerImage.node  = aArc.fromNode;

		this.arcMarkerImage.image = this.arcMarkerImage.node.image;


		this.arcMarkerImage.x      = aX;
		this.arcMarkerImage.y      = aY;
		this.arcMarkerImage.arc    = aArc;
		this.arcMarkerImage.hidden = false;

		this.showArcMarkerImageTimer = window.setTimeout(function() {
			WebMapView.hideArcMarkerImage();
		}, this.service.getPref('webmap.arc.marker.delay.hide'));
	},
 
	hideArcMarkerImage : function() 
	{
		if (this.arcMarkerImage.hidden || !this.showArcMarkerImageTimer)
			return;

		window.clearTimeout(this.showArcMarkerImageTimer);
		this.showArcMarkerImageTimer = null;
		this.arcMarkerImage.hidden   = true;
	},
  
	onBuildStart : function() 
	{
		if (this.isBuilding) return;

		this.isBuilding = true;
		this.canvas.setAttribute('node-building', true);
		this.service.notifyObservers('webmap:view:build', 'start');
	},
 
	onBuildEnd : function() 
	{
		if (!this.isBuilding) return;

		if (this.onBuildEndTimer) {
			window.clearInterval(this.onBuildEndTimer);
			this.onBuildEndTimer = null;
		}

		this.onBuildEndTimer = window.setTimeout(this.onBuildEndCallback, 100);
	},
	onBuildEndTimer : null,
	onBuildEndCallback : function()
	{
		var id;

		for (i in WebMapView.buildingNodes)
		{
			id = i;
			break;
		}
		if (id) return;

		for (i in WebMapView.buildingArcs)
		{
			id = i;
			break;
		}
		if (id) return;

		WebMapView.isBuilding = false;
		WebMapView.canvas.removeAttribute('node-building');
		WebMapService.notifyObservers('webmap:view:build', 'end');
	},
 
	loadCache : function(aCallbackFunc) 
	{
		var doc  = document.implementation.createDocument(
				'http://www.w3.org/2000/svg',
				'',
				null
			);

		doc.onload = aCallbackFunc;

		try {
			doc.load(this.service.dataDirURI+'webmapcache.xml');
		}
		catch(e) {
			return { error : true, document : doc };
		}

		return { error : false, document : doc };
	},
	loadCacheCallback : function(aDoc)
	{
		var doc = aDoc;
		if (!doc || !doc.documentElement) return;

		if (doc.documentElement.getAttribute('version') != this.cacheVersion) return;

		var node = this.viewDocument.getElementById('worlds');
		node.parentNode.replaceChild(doc.getElementById('worlds').cloneNode(true), node);
	},
 
	saveCache : function() 
	{
		var root = document.createElementNS(this.SVGNS, 'svg');
		var node = this.viewDocument.getElementById('worlds');
		var doc  = document.implementation.createDocument(
				'http://www.w3.org/2000/svg',
				'',
				null
			);
		root.appendChild(node.cloneNode(true));
		root.setAttribute('version', this.cacheVersion);
		doc.appendChild(root);

		var PERSIST = Components.classes['@mozilla.org/embedding/browser/nsWebBrowserPersist;1'].createInstance(Components.interfaces.nsIWebBrowserPersist);

		var mimeType = 'application/xml';
		var dataFile = this.service.getFileFromURLSpec(this.service.dataDirURI+'webmapcache.xml');
		var parentDir = dataFile.parent;

		const nsIWebPersist = Components.interfaces.nsIWebBrowserPersist;
		var outputFlag = nsIWebPersist.ENCODE_FLAGS_ENCODE_ENTITIES | nsIWebPersist.ENCODE_FLAGS_FORMATTED;

		PERSIST.saveDocument(doc, dataFile, parentDir, mimeType, outputFlag, 0);
	},
 
	rebuild : function() 
	{
		if (this.rebuildTimer) {
			window.clearInterval(this.rebuildTimer);
			this.rebuildTimer = null;
		}

		this.worlds.all    = new WebMapWorld(this.viewDocument.getElementById('world-all'));
		this.worlds.domain = new WebMapWorld(this.viewDocument.getElementById('world-domain'));

		this.world = this.worlds.all;

		this.initScrollButtons();

		this.service.notifyObservers('webmap:world-zoomed', this.world.scale);

		this.toggleMapMode(this.service.getPref('webmap.world.mode') == 'all');


		this.clearFocus();
		this.clearSelection();
		this.clearArcMarker();

		var builder = new WebMapNodesBuilder();
		builder.run();
	},
	
	clear : function() 
	{
		this.buildingNodes = {};
		this.buildingArcs  = {};

		this.nodeHelpers = {};
		this.arcHelpers  = {};

		this.gridInfo[this.DOMAIN_SAME]      = {};
		this.gridInfo[this.DOMAIN_SIMILAR]   = {};
		this.gridInfo[this.SIMILAR_CONTENTS] = {};
		this.gridInfo[this.DOMAIN_FOREIGN]   = {};
		this.gridInfo[this.DOMAIN_UNRELATED] = {};

		if (this.world) {
			var range = this.arcsLayer.ownerDocument.createRange();

			range.selectNodeContents(this.arcsLayer);
			range.deleteContents();

			range.selectNodeContents(this.nodesLayer);
			range.deleteContents();

			range.detach();
		}
	},
  
	redraw : function(aForce) 
	{
		if (aForce) this.clearArcMarker();
		this.world.redraw(aForce);
	},
 
	// nsIObserver 
	observe : function(aSubject, aTopic, aData)
	{
		if (this.service.debug)
			dump('WebMapView::observe ('+aTopic+')\n  '+String(aData).replace(/\n/gi, '\n  ')+'\n');

		aData = (String(aData) || '').split('\n');
		switch (aTopic)
		{
			case 'webmap:service:node-operation':
				switch (aData[0])
				{
					case 'update':
						if (!this.world) return;
						window.setTimeout(function() {
							if (WebMapView.checkNodeExists(aData[2])) {
								var node = WebMapView.getNode(aData[2]);
								if (node) {
									if (aData[1].match(/(^|,)(name|image|favicon|thumbnail)($|,)/)) {
										WebMapView.updateNode(node);
									}
									else {
										var ds = WebMapService.getDataSourceForURI(aData[2]);
										if (ds)
											WebMapView.updateArcsFor(node, ds);
										WebMapView.updateDomainNodeFor(node);
									}
								}
							}
							else {
								WebMapView.createNode({
									URI      : aData[2],
									baseNode : (
										(aData.length > 3 && aData[3]) ?
										WebMapView.getNode(aData[3]) :
										null
									)
								});
							}
							aData = null;
						}, 0);
						break;

					case 'remove':
						if (!this.world) return;
						window.setTimeout(function() {
							WebMapView.removeNode(WebMapView.getNode(aData[1]));
							aData = null;
						}, 0);
						break;

					default:
						break;
				}

			case 'webmap:service:arc-operation':
				if (!this.world) return;
				if (aData[0] == 'removed' && aData[1])
					window.setTimeout(function() {
						WebMapView.removeArc(WebMapView.getArcById(aData[1]));
					}, 0);
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
			!this.service.browser
			)
			return;

		this.activated = true;

		this.service.nsIObserverService.addObserver(this, 'webmap:service:node-operation', false);
		this.service.nsIObserverService.addObserver(this, 'webmap:service:arc-operation', false);

		if (this.service.getPref('webmap.world.x') == 'NaN')
			this.service.setPref('webmap.world.x', '0');
		if (this.service.getPref('webmap.world.y') == 'NaN')
			this.service.setPref('webmap.world.y', '0');


		switch (this.service.getPref('webmap.image.type'))
		{
			case 1:
				this.canvas.setAttribute('image', 'favicon');
				break;
			case 2:
				this.canvas.setAttribute('image', 'thumbnail');
				break;
			default:
				this.canvas.removeAttribute('image');
				break;
		}

		this.clear();


		var res = this.loadCache(function(aEvent) {
			WebMapView.loadCacheCallback(res.document);
			WebMapView.rebuild();
		});
		if (res.error)
			WebMapView.rebuild();

		this.service.notifyObservers('webmap:view:window', 'open');
	},
 
	destroy : function() 
	{
		if (!this.activated) return;

		this.activated = false;

		this.saveCache();

		this.service.nsIObserverService.removeObserver(this, 'webmap:service:node-operation');
		this.service.nsIObserverService.removeObserver(this, 'webmap:service:arc-operation');

		this.service.notifyObservers('webmap:view:window', 'close');
	},
 
	toString : function()
	{
		return '[object WebMapView]';
	}
}; 
  
function WebMapWorld(aNode) 
{
	this.init(aNode);
}

WebMapWorld.prototype = {
	active : false,

	scrollListeners : null,
	
	// properties 
	
	get node() 
	{
		return this.mNode;
	},
	set node(val)
	{
		if (!this.mNode) this.mNode = val;
		return this.mNode;
	},
	mNode : null,
 
	get preventRedraw() 
	{
		return this._preventRedraw;
	},
	set preventRedraw(val)
	{
		this._preventRedraw = Boolean(val);
		if (this._preventRedraw) {
			this.canvas.suspendRedraw(60000);
		}
		else {
			this.canvas.unsuspendRedrawAll();
		}
		return this._preventRedraw;
	},
	_preventRedraw : null,
 
	get redrawInterval() 
	{
		return Math.max(WebMapService.getPref('webmap.redraw.interval'), 1);
	},
 
	get arcsLayer() 
	{
		if (!this.mArcsLayer) {
			this.mArcsLayer = this.node.childNodes[0];
		}
		return this.mArcsLayer;
	},
	mArcsLayer : null,
 
	get nodesLayer() 
	{
		if (!this.mNodesLayer) {
			this.mNodesLayer = this.node.childNodes[1];
		}
		return this.mNodesLayer;
	},
	mNodesLayer : null,
 
	get x() 
	{
		if (this.node)
			return Number(this.node.getAttribute('x') || 0);

		return 0;
	},
	set x(val)
	{
		if (!this.node) { // not initialized
			var obj = this;
			window.setTimeout(function() { obj.x = val; }, 0);
		}
		else {
			this.node.setAttribute('x', Number(val));
			this.updateTransform();
			this.savePosition();
		}
		return this.x;
	},
 
	get y() 
	{
		if (this.node)
			return Number(this.node.getAttribute('y') || 0);

		return 0;
	},
	set y(val)
	{
		if (!this.node) { // not initialized
			var obj = this;
			window.setTimeout(function() { obj.y = val; }, 0);
		}
		else {
			this.node.setAttribute('y', Number(val));
			this.updateTransform();
			this.savePosition();
		}
		return this.y;
	},
 
	get viewWidth() 
	{
		return this.node.ownerDocument.defaultView.innerWidth+Number(WebMapView.viewWidthRevision || 0);
	},
 
	get viewHeight() 
	{
		return this.node.ownerDocument.defaultView.innerHeight+Number(WebMapView.viewHeightRevision || 0);
	},
 
	get scale() 
	{
		if (this.node)
			return Number(this.node.getAttribute('scale') || 1);

		return 0;
	},
	set scale(val)
	{
		if (!this.node) { // not initialized
			var obj = this;
			window.setTimeout(function() { obj.scale = val; }, 0);
		}
		else {
			var scale = Number(val);
			scale = Math.min(
						Math.max(
							scale,
							WebMapService.getPref('webmap.world.scale.min')
						),
						WebMapService.getPref('webmap.world.scale.max')
					);
			this.node.setAttribute('scale', scale);
			this.updateTransform();
		}
		return this.scale;
	},
 
/*	get rotation() 
	{
		if (this.node)
			return Number(this.node.getAttribute('rotation') || 0);

		return 0;
	},
	set rotation(val)
	{
		if (!this.node) { // not initialized
			var obj = this;
			window.setTimeout(function() { obj.rotation = val; }, 0);
		}
		else {
			var rotation = Number(val);

			if (rotation < 0)
				rotation += 360;
			else if (rotation > 360)
				rotation -= 360;

			this.node.setAttribute('rotation', rotation);
			this.updateTransform();
		}
		return this.rotation;
	},*/
 
	get viewPortX() 
	{
		return -(this.x/(Math.max(this.scale, 1)/100));
	},
 
	get viewPortY() 
	{
		return -(this.y/(Math.max(this.scale, 1)/100));
	},
 
	get viewPortWidth() 
	{
		return this.viewWidth/(Math.max(this.scale, 1)/100);
	},
 
	get viewPortHeight() 
	{
		return this.viewHeight/(Math.max(this.scale, 1)/100);
	},
 
	get canvas() 
	{
		return this.node.ownerDocument.getElementById('canvas');
	},
  
	savePosition : function() 
	{
		if (this.savePositionTimer) {
			window.clearTimeout(this.savePositionTimer);
			this.savePositionTimer = null;
		}
		this.savePositionTimer = window.setTimeout(this.savePositionCallback, 10, this);
	},
	savePositionTimer    : null,
	savePositionCallback : function(aWorld)
	{
		WebMapService.setPref('webmap.world.x', String(aWorld.x));
		WebMapService.setPref('webmap.world.y', String(aWorld.y));
	},
 
	updateTransform : function() 
	{
		if (this.updateTransformTimer) {
			window.clearTimeout(this.updateTransformTimer);
			this.updateTransformTimer = null;
		}
		this.updateTransformTimer = window.setTimeout(this.updateTransformCallback, 0, this);
	},
	updateTransformTimer    : null,
	updateTransformCallback : function(aWorld)
	{
		aWorld.node.setAttribute(
			'transform',
			[
				'translate(', aWorld.x, ', ', aWorld.y, ')',
				'scale(', Math.max(aWorld.scale, 1)/100, ')'/*,
				'rotate(', this.rotation, ')'*/
			].join(' ')
		);
	},
 
	// scroll buttons 
	
	registerScrollListener : function(aListener) 
	{
		this.scrollListeners.push(aListener);
	},
 
	unregisterScrollListener : function(aListener) 
	{
		for (var i in this.scrollListeners)
			if (this.scrollListeners[i] == aListener) {
				this.scrollListeners.splice(i, 1);
				return;
			}
	},
  
	redraw : function(aForce) 
	{
		if (aForce)
			this.redrawForceRequested = aForce;

		if (this.preventRedraw || this.redrawing) return;

		if (this.redrawTimer) {
			window.clearTimeout(this.redrawTimer);
			this.redrawTimer = null;
		}

		this.canvas.setAttribute('drawing', true);

		this.redrawTimer = window.setTimeout(
			this.redrawCallback,
			this.redrawInterval,
			this
		);
	},
	redrawing            : false,
	redrawForceRequested : false,
	redrawTimer          : null,
	redrawCallback : function(aWorld)
	{
		aWorld.redrawing = true;

		if (aWorld.redrawForceRequested) {
			WebMapService.notifyObservers('webmap:view:node-operation:all', 'redraw');
			aWorld.redrawForceRequested = false;

			aWorld.canvas.removeAttribute('drawing');
			window.setTimeout(aWorld.redrawCallback2, 0, aWorld);
		}
		else {
			aWorld.canvas.removeAttribute('drawing');
			aWorld.redrawCallback2(aWorld);
		}

		aWorld.redrawTimer = null;
		aWorld.redrawing   = false;
	},
	redrawCallback2 : function(aWorld)
	{
		// http://lxr.mozilla.org/mozilla/source/dom/public/idl/svg/nsIDOMSVGSVGElement.idl
		aWorld.canvas.forceRedraw();
	},
 
	handleEvent : function(aEvent) 
	{
		if (WebMapView.preventShowHideScrollButtons ||
			!WebMapService.getPref('webmap.world.scroll.button.autohide'))
			return;

		var area = WebMapService.getPref('webmap.world.scroll.button.autohide.area');

		if (
			aEvent.clientX < 2 ||
			aEvent.clientY < 2 ||
			aEvent.clientX > this.viewWidth - 2 ||
			aEvent.clientY > this.viewHeight - 2 ||
			!(
			aEvent.clientX < area+2 ||
			aEvent.clientY < area+2 ||
			aEvent.clientX > this.viewWidth - area+2 ||
			aEvent.clientY > this.viewHeight - area+2
			)
			)
			WebMapView.hideScrollButtons();
		else
			WebMapView.showScrollButtons();
	},
 
	init : function(aNode) 
	{
		this.node     = aNode;
		this.x        = Number(WebMapService.getPref('webmap.world.x'));
		this.y        = Number(WebMapService.getPref('webmap.world.y'));
		this.scale    = WebMapService.getPref('webmap.world.scale');
/*		this.rotation = WebMapService.getPref('webmap.world.rotation');*/

		this.scrollListeners = [];

		this.node.ownerDocument.defaultView.addEventListener('mousemove', this, false);

		this.node.worldObject = this;

		this.redraw();
	},
 
	toString : function()
	{
		return '[object WebMapWorld]';
	}
}; 
  
function WebMapScrollButton(aNode, aPositionMaker, aScrollCalculator) 
{
	this.init(aNode, aPositionMaker, aScrollCalculator);
}

WebMapScrollButton.prototype = {

	positionMaker    : null,
	scrollCalculator : null,

	scrollTimer           : null,
	scrollAutoRepeatTimer : null,
	
	// properties 
	
	get node() 
	{
		return this.mNode;
	},
	set node(val)
	{
		if (!this.mNode) this.mNode = val;
		return this.mNode;
	},
	mNode : null,
 
	get x() 
	{
		if (this.node)
			return Number(this.node.getAttribute('x') || 0);

		return 0;
	},
	set x(val)
	{
		if (!this.node) { // not initialized
			var obj = this;
			window.setTimeout(function() { obj.x = val; }, 0);
		}
		else {
			this.node.setAttribute('x', Number(val));
			this.updateTransform();
		}
		return this.x;
	},
 
	get y() 
	{
		if (this.node)
			return Number(this.node.getAttribute('y') || 0);

		return 0;
	},
	set y(val)
	{
		if (!this.node) { // not initialized
			var obj = this;
			window.setTimeout(function() { obj.y = val; }, 0);
		}
		else {
			this.node.setAttribute('y', Number(val));
			this.updateTransform();
		}
		return this.y;
	},
  
	handleEvent : function(aEvent) 
	{
		switch (aEvent.type)
		{
			case 'mouseover':
				this.startScroll();
				return;

			case 'mouseout':
				this.stopScroll();
				return;

			case 'click':
				aEvent.stopPropagation();
				this.stopScroll();
				this.startScroll();
				var scrollInfo = this.doScroll();
				return;

			case 'dblclick':
				aEvent.stopPropagation();
				return;

			case 'resize':
				this.updatePosition();
				return;

			case 'unload':
				window.removeEventListener('resize', this, false);
				window.removeEventListener('unload', this, false);
				this.node.removeEventListener('mouseover', this, false);
				this.node.removeEventListener('mouseout',  this, false);
				this.node.removeEventListener('click',     this, false);
				return;

			default:
				return;
		}
	},
 
	startScroll : function() 
	{
		if (!this.scrollTimer) {
			var start_timeout = WebMapView.service.getPref('webmap.world.scroll.button.start_timeout');
			if (start_timeout > -1)
				this.scrollTimer = window.setTimeout(
					this.startScrollCallback,
					start_timeout,
					this
				);
		}
	},
	startScrollCallback : function(aButton)
	{
		aButton.scrollAutoRepeatTimer = window.setInterval(
			aButton.scrollAutoRepeat,
			WebMapView.service.getPref('webmap.world.scroll.button.repeat'),
			aButton
		);
	},
	scrollAutoRepeat : function(aButton)
	{
		var scrollInfo = aButton.doScroll();
		for (var i = 0; i < WebMapView.world.scrollListeners.length; i++)
		{
			try {
				WebMapView.world.scrollListeners[i].onAutoRepeatScroll(scrollInfo);
			}
			catch(e) {
			}
		}
	},
 
	stopScroll : function() 
	{
		if (this.scrollAutoRepeatTimer) {
			window.clearInterval(this.scrollAutoRepeatTimer);
			this.scrollAutoRepeatTimer = null;
		}
		if (this.scrollTimer) {
			window.clearTimeout(this.scrollTimer);
			this.scrollTimer = null;
		}
	},
 
	doScroll : function() 
	{
		this.node.setAttribute('button-active', true);
		var info = this.scrollCalculator(WebMapView.service.getPref('webmap.world.scroll.step.button'));
		WebMapView.pan(info.x, info.y);

		var node = this.node;
		window.setTimeout(
			function() {
				node.removeAttribute('button-active');
				nude = null;
			},
			Math.max(WebMapView.service.getPref('webmap.world.scroll.button.repeat'), 1)/2
		);

		return info;
	},
 
	updatePosition : function() 
	{
		if (this.updatePositionTimer) {
			window.clearTimeout(this.updatePositionTimer);
			this.updatePositionTimer = null;
		}
		this.updatePositionTimer = window.setTimeout(this.updatePositionCallback, 0, this);
	},
	updatePositionTimer    : null,
	updatePositionCallback : function(aButton)
	{
		var value = aButton.positionMaker();
		aButton.node.setAttribute(
			'transform',
			[
				'translate(', value.x, ', ', value.y, ')'
			].join(' ')
		);
	},
 
	init : function(aNode, aPositionMaker, aScrollCalculator) 
	{
		this.node             = aNode;
		this.positionMaker    = aPositionMaker;
		this.scrollCalculator = aScrollCalculator;

		this.updatePosition();

		this.node.addEventListener('mouseover', this, false);
		this.node.addEventListener('mouseout',  this, false);
		this.node.addEventListener('click',     this, false);
		this.node.addEventListener('dblclick',  this, false);

		window.addEventListener('resize', this, false);
		window.addEventListener('unload', this, false);
	},
 
	toString : function()
	{
		return '[object WebMapScrollButton]';
	}
}; 
  
function WebMapNodesBuilder() 
{
}

WebMapNodesBuilder.prototype = {

	buildTimer : null,
	
	run : function() 
	{
		const sv = WebMapService;

		this.currentNode = sv.getTarget(sv.rootDataSource, sv.rootContainerNode, sv.NS+'FirstEntry');
		if (this.currentNode)
			this.buildTimer = window.setTimeout(this.buildNode, 0, this);
	},
 
	buildNode : function(aBuilder) 
	{
		if (!aBuilder.currentNode) return;

		var uri = aBuilder.currentNode.Value;
		var ds  = WebMapService.getDataSourceForURI(uri);
		if (!ds) return;

		if (!WebMapView.checkNodeExists(uri)) {
			WebMapView.createNode({ URI : uri });
		}
		else if (WebMapView.getNode(uri)) {
			aBuilder.currentNode = WebMapService.getTarget(ds, aBuilder.currentNode, WebMapService.NS+'LaterEntry');
		}

		aBuilder.buildTimer = window.setTimeout(arguments.callee, 100, aBuilder);
	},
 
	toString : function()
	{
		return '[object WebMapNodesBuilder]';
	}
}; 
  
