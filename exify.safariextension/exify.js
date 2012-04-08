var EXIFy = {
	init: function() {
		safari.self.addEventListener('message', EXIFy._onMessage, false);
		document.addEventListener('contextmenu', EXIFy._onContextMenu, false);
		
		EXIFy._images = [];
		
		EXIFy._$mask = $('<div id="EXIFy-mask"></div>');
		EXIFy._$lightbox = $('<div id="EXIFy-lightbox"><img /><section><h1>EXIF Data</h1><ul></ul></section></div>').appendTo(EXIFy._$mask);
		
		EXIFy._$mask.click(function(evt) {
			if (evt.target.id !== 'EXIFy-lightbox' && $(evt.target).parents('#EXIFy-lightbox').length === 0) {
				EXIFy._hideMask();
			}
		});
	},
	
	enableClickEvents: function() {
		if (EXIFy._enabled) {
			return;
		}
		
		EXIFy._enabled = true;
		
		$('img')
			.bind('mouseover.EXIFy', function(evt) {
				var img = $(this);
				img .data('previous-outline', img.css('outline'))
					.data('previous-cursor', img.css('cursor'))
					.css('outline', '3px solid red')
					.css('cursor', 'pointer');
					
				evt.stopPropagation();
			})
			.bind('mouseout.EXIFy', function(evt) {
				var img = $(this);
				img .css('outline', img.data('previous-outline'))
					.css('cursor', img.data('previous-cursor'))
					.data('previous-outline', '')
					.data('previous-cursor', '');
					
				evt.stopPropagation();
			})
			.bind('click.EXIFy', function(evt) {
				EXIFy._showMask(this);
				
				evt.stopPropagation();
				evt.preventDefault();
			});
	},
	
	disableClickEvents: function() {
		if (!EXIFy._enabled) {
			return;
		}
		
		EXIFy._enabled = false;
		
		EXIFy._$mask.detach();
		
		$('img')
			.unbind('mouseover.EXIFy')
			.unbind('mouseout.EXIFy')
			.unbind('click.EXIFy');
	},
	
	_enabled: false,
	
	_images: null,

	_$mask: null,
	_$lightbox: null,
	
	_$contextMenuTarget: null,
	
	_showMask: function(img) {
		$('img', EXIFy._$lightbox).attr({'src':img.src, 'title':img.title});
		
		var $ul = $('ul', EXIFy._$lightbox).html('').append($('<li><em>Loading...</em></li>'));
		
		EXIFy._loadImageData(img, function() {
			var tags = EXIF.getAllTags(img);
			var totalTags = 0;
			
			$ul.html('');
			
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
		});
		
		EXIFy._$mask.appendTo(document.body);
		
		var $body = $(document.body);
		
		$body
			.bind('keypress.EXIFy', function(evt) {
				if (evt.keyCode === 27) {
					EXIFy._hideMask();
				}
				
				evt.stopPropagation();
			})
			.data('previous-overflow', $body.css('overflow'))
			.css('overflow', 'hidden');
	},
	_hideMask: function() {
		var $body = $(document.body);
		$body
			.unbind('keypress.EXIFy')
			.css('overflow', $body.data('previous-overflow'))
			.data('previous-overflow', '');

		EXIFy._$mask.detach();
	},
	_loadImageData: function(img, callback) {
		if (img.exifdata) {
			callback();
			return;
		}
		
		var imgId = EXIFy._images.length;
		EXIFy._images[imgId] = {
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
		var img = EXIFy._images[id].img;
		
		img.exifdata = EXIF.readFromBinaryFile(bin);
		
		EXIFy._images[id].callback();
		
		EXIFy._images[id] = null;
	},
	_onImageLoadFailed: function(id) {
		EXIFy._images[id] = null;
		
		console.log('EXIFy: There was a failure while loading image data.');
	},
	_onToggleEXIFy: function() {
		if (EXIFy._enabled) {
			EXIFy.disableClickEvents();
		} else {
			EXIFy.enableClickEvents();
		}
	},
	_onMessage: function(event) {
		switch (event.name) {
			case 'imageDataLoaded': return EXIFy._onImageDataLoaded(event.message.id, event.message.data);
			case 'imageLoadFailed': return EXIFy._onImageLoadFailed(event.message.id);
			case 'toggleEXIFy': return EXIFy._onToggleEXIFy();
			case 'contextMenuViewEXIFData': return EXIFy._onContextMenuViewEXIFData();
			case 'log': console.log(event.message);
		}
	},
	_onContextMenu: function(event) {
		EXIFy._$contextMenuTarget = $(event.target);
		safari.self.tab.setContextMenuEventUserInfo(event, {
			targetNodeName: event.target.nodeName,
			clickEventsEnabled: EXIFy._enabled
		});
	},
	_onContextMenuViewEXIFData: function() {
		EXIFy._showMask(EXIFy._$contextMenuTarget[0]);
	}
};

$(function() {
	EXIFy.init();
});
