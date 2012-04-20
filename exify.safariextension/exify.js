var EXIFy = function() {
	this.init();
}

EXIFy.prototype = {
	init: function() {
		safari.self.addEventListener('message', $.proxy(this._onMessage, this), false);
		document.addEventListener('contextmenu', $.proxy(this._onContextMenu, this), false);
		
		this._images = {};
		
		this._$iframe = $('<iframe id="EXIFy-iframe"></iframe>');
	},
	
	enableClickEvents: function() {
		var self = this;
		
		if (this._enabled) {
			return;
		}
		
		this._enabled = true;
		
		$('img')
			.bind('mouseover.EXIFy', function(evt) {
				self._highlightImage(this);
				evt.stopPropagation();
			})
			.bind('mouseout.EXIFy', function(evt) {
				self._unhighlightImage();
				evt.stopPropagation();
			})
			.bind('click.EXIFy', function(evt) {
				self._showMask(this);
				
				evt.stopPropagation();
				evt.preventDefault();
			});
	},
	
	disableClickEvents: function() {
		if (!this._enabled) {
			return;
		}
		
		this._enabled = false;
		
		this._unhighlightImage();
		
		$('img')
			.unbind('mouseover.EXIFy')
			.unbind('mouseout.EXIFy')
			.unbind('click.EXIFy');
	},
	
	_highlightImage: function(img) {
		this._highlightedImage = img;
		
		var $img = $(img);
		$img .data('previous-outline', $img.css('outline'))
			.data('previous-cursor', $img.css('cursor'))
			.css('outline', '3px solid red')
			.css('cursor', 'pointer');
	},
	
	_unhighlightImage: function() {
		var $img = $(this._highlightedImage);
		$img .css('outline', $img.data('previous-outline'))
			.css('cursor', $img.data('previous-cursor'))
			.data('previous-outline', '')
			.data('previous-cursor', '');
		
		this._highlightedImage = null;
	},
	
	_enabled: false,
	
	_current: 1,
	_images: null,
	
	_highlightedImage: null,

	_$iframe: null,
	
	_$contextMenuTarget: null,
	
	_showMask: function(img) {
		var self = this;
		
		var $body = $(document.body);
		
		$body
			// .bind('keypress.EXIFy', function(evt) {
			// 	if (evt.keyCode === 27) {
			// 		EXIFy._hideMask();
			// 	}
			// })
			.data('previous-overflow', $body.css('overflow'))
			.css('overflow', 'hidden');
		
		this._$iframe.appendTo(document.body);
		
		setTimeout(function() {
			var iframeDoc = self._$iframe[0].contentDocument;
			var $iframeBody = $(iframeDoc.body).attr('id', 'EXIFy-iframe-body');
			
			var mask = iframeDoc.createElement('div');
			var $mask = $(mask).attr('id', 'EXIFy-mask').appendTo($iframeBody);
			
			var lightbox = iframeDoc.createElement('div');
			var $lightbox = $(mask).attr('id', 'EXIFy-lightbox').html('<img /><section><h1>EXIF Data</h1><ul></ul></section>').appendTo($iframeBody);
			
			// var closeButton = iframeDoc.createElement('a');
			// var $closeButton = $(closeButton).attr('id', 'EXIFy-close-button').html('Close EXIFy').appendTo($lightbox);
			
			$iframeBody.click(function(evt) {
				if (evt.target.id !== 'EXIFy-lightbox' && $(evt.target).parents('#EXIFy-lightbox').length === 0) {
					self._hideMask();
				}
			});
			
			self._loadImageData(img, function() {
				self._onLoadImageData(img);
			});
		}, 10);
	},
	_onLoadImageData: function(img) {
		var iframeDoc = this._$iframe[0].contentDocument;
		var $iframeBody = $(iframeDoc.body);
					
		var $ul = $('ul', $iframeBody).html('').append($('<li><em>Loading...</em></li>'));
		
		$('img', $iframeBody).attr({'src':img.src, 'title':img.title});
		
		var tags = EXIF.getAllTags(img);
		var totalTags = 0;
		
		$ul.html('');
		
		console.log(tags);
		
		for (var key in tags) {
			tags[key] = $.trim(tags[key]);
			
			if (tags[key] !== '') {
				++totalTags;
				$('<li><span>' + key + '</span>: ' + tags[key] + '</li>').appendTo($ul);
			}
		}
		
		if (totalTags === 0) {
			$('<li><em>No data available!</em></li>').appendTo($ul);
		}
	},
	_hideMask: function() {
		this._$iframe.detach();
		
		var $body = $(document.body);
		
		$body
			// .unbind('keypress.EXIFy')
			.css('overflow', $body.data('previous-overflow'))
			.data('previous-overflow', '');
	},
	_loadImageData: function(img, callback) {
		if (img.exifdata) {
			callback();
			return;
		}
		
		var imgId = 'img-' + (this._current++);
		
		this._images[imgId] = {
			img: img,
			src: img.src,
			callback: callback
		};
		
		safari.self.tab.dispatchMessage('imageDataRequested', {
			url: img.src,
			id: imgId
		});
	},
	_onImageDataLoaded: function(id, data) {
		var bin = new BinaryFile(data);
		var img = this._images[id].img;
		
		img.exifdata = EXIF.readFromBinaryFile(bin);
		
		this._images[id].callback();
		
		this._images[id] = null;
	},
	_onImageLoadFailed: function(id) {
		this._images[id] = null;
		
		console.log('EXIFy: There was a failure while loading image data.');
	},
	_onToggleEXIFy: function() {
		if (this._enabled) {
			this.disableClickEvents();
		} else {
			this.enableClickEvents();
		}
	},
	_onMessage: function(event) {
		switch (event.name) {
			case 'imageDataLoaded': return this._onImageDataLoaded(event.message.id, event.message.data);
			case 'imageLoadFailed': return this._onImageLoadFailed(event.message.id);
			case 'toggleEXIFy': return this._onToggleEXIFy();
			case 'contextMenuViewEXIFData': return this._onContextMenuViewEXIFData();
			case 'log': console.log(event.message);
		}
	},
	_onContextMenu: function(event) {
		this._$contextMenuTarget = $(event.target);
		safari.self.tab.setContextMenuEventUserInfo(event, {
			targetNodeName: event.target.nodeName,
			clickEventsEnabled: this._enabled
		});
	},
	_onContextMenuViewEXIFData: function() {
		this._showMask(this._$contextMenuTarget[0]);
	}
};

// For now, only load EXIFy on the main window. We need to find a way to allow iframes to load EXIFy,
// but also to prevent all iframes from responding to the same messages coming from the global file.
if (window.top === window) {
	var exify = new EXIFy();
}
