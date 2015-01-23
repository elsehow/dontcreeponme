( function() {

	// ````````````````````````````
	// initialization
	// ,,,,,,,,,,,,,,,,,,,,,,,,,,,,

	my = {}

	my.colorpalette =  [
	                ['#FF0000', '#E8E712', '#7EE8D1'],
	                ['#0002E8','#EB2FFF', '#FF730A'], ];
	my.windowIsInFocus = true;
	my.scrolledToBottom = true;
	my.notificationSound = new Audio('notify.ogg');
	my.roomName = document.location.pathname.split('/')[1];

	my.messageInput = $('#messageInput');
	my.submitButton = $("#submit");
	my.conversationContainer = $("#chatEntries")

	windowFocusInit();
	window.setInterval(setTimeAgo, 1000*10);

	// my.conversationContainer.empty();	
	$('#chatURL').val('https://dontcreepon.me/'.concat(my.roomName));
	setupColorPicker();
	showModalInterface();

	// set focus to message input on all mouseup
	$('body').mouseup(function() {
		my.messageInput.focus()
	})

	setupScrollListener();
	my.submitButton.click(function() {sentMessage();});

	my.socket = io.connect();


	// ```````````````````````````
	// socket listeners
	// ,,,,,,,,,,,,,,,,,,,,,,,,,,,

	// socket.on('connect', function() {
	// });

	my.socket.on('newuserlist', function(userlist) {
		my.current_userlist = userlist;
		updateUserlistDiv(userlist);
	});

	my.socket.on('announcement', function(data) {
		addMessage(data, '', true);

	});

	my.socket.on('message', function(data) {

		var from = data['pseudo'];
		// don't show the message if it's from us
		// we add the client's own messages on sentMessage() instead
		if (from !== my.pseudonym) {
			addMessage(data['message'], from, false);
		}

		// increment unread message count if window's not in focus
		if (!my.windowIsInFocus || !my.scrolledToBottom)  my.unreadMessageCount++;

		if (!my.windowIsInFocus) {
			updatePageTitle();
		} 
	});

	my.socket.on('disconnect', function() {
		//when server disconnects us, show user the modal interface
		showModalInterface();
	})


	// ```````````````````````
	// various UI functions
	// ,,,,,,,,,,,,,,,,,,,,,,,,

	function sentMessage() {
		if (my.messageInput.val() != "") {
			my.socket.emit('message',my.messageInput.val());
			addMessage(send_message, my.pseudonym, false);
			my.messageInput.val('');
			my.submitButton.button('loading');
			
		}
	}

	function updateUserlistDiv(usersobject) { 

		var count = 0;
		var userlistDiv = $('#userlistDiv');
		userlistDiv.empty();

		$.each(my.current_userlist,function(username,color)  {

			if (username) {
				count++;
				userlistDiv.append(
					$('<span>' + username + ' </span>').css('color','#'+color)
				);
			}

		});

	}


	function addMessage(msg, pseudo, isAnnouncement) {

		var date = new Date().toISOString();

		var fromSelf = false;
		if (pseudo === my.pseudonym)
			fromSelf = true

		//check msg for links
		msg = replaceURLWithHTMLLinks(msg);

		//check msg for mentions of user
		msg = findUserMentions(msg,my.pseudonym);

		// if this is from the same person that sent the last message,
		// and the messages came close together
		// append it to the div of the last message
		if ((pseudo === my.last_message_pseudo) && (new Date(date) - new Date(my.last_message_date) < 50000)) {
			appendToMostRecentMessage(msg)
		}

		// if not, add a new message div to the conatiner 
		else {
			$div = createMessageDiv(msg, pseudo, date, fromSelf, isAnnouncement)
			my.conversationContainer.append($div);
			// returns at most 1 image or video
			msg = pullImagesFromLinks(msg,$div);
		}

		my.last_message_pseudo = pseudo;
		my.last_message_date = date;
		setConversationScroll();
		setTimeAgo();
	}

	function createMessageDiv(msg, pseudo, date, fromSelf, isAnnouncement) {
		// create the message div 
		var divClass = "row message";
		if(fromSelf) divClass += " self";
		else if(isAnnouncement) divClass += " admin";

		var divString = '<div class="'+divClass+'">'

		if(fromSelf) {
			divString += '<div class = "msgcolor"></div><div class="meta">'+getDateDiv(date)+pseudo+'</div>';
		} else if (isAnnouncement) {
			divString += '<div class="meta">'+getDateDiv(date)+'</div>';
		} else {
			divString += '<div class = "msgcolor"></div><div class="meta">'+pseudo+getDateDiv(date)+'</div>';
		}

		divString+='<p>' + msg + '</p></div>';
		var $div = $(divString);

		if (!isAnnouncement) {
			// set the tag color according to user color
			if (fromSelf) $div.find(".msgcolor").css('background-color',my.color);
			else $div.find(".msgcolor").css('background-color','#'+my.current_userlist[pseudo]);
		}

		return $div

	}

	function appendToMostRecentMessage(msg) {
		// get the last div
		var $last_message = $( "#chatEntries .message").last();
		$last_message.append("<p>" + msg + "</p>");
		// returns at most 1 image or video
		msg = pullImagesFromLinks(msg, $last_message);
		// adjust the height of the color bar
		$last_message.children('.msgcolor').css('height',$last_message.height()-14)
		return $last_message
	}

	function enterChatroom(proposed_username) {
		// we are in, hide the modal interface
		$('#pickUsername').hide();
		// show chat window
		$("#main").show();
		// bind enter to send
		bindEnterToSendMessage();
		// highlight the text entry field
		$(my.messageInput).focus().click();
		// turn page title into chatroom name
		updatePageTitle();
	}

	function getDateDiv(date) {
		return '<time class="date" title="'+date+'">'+date+'</time>';
	}


	function bindEnterToPseudoSubmit() {
		// when the client hits ENTER
		$('#pseudoInput').keypress(function(e) {
			if(e.which == 13) {
				$(this).blur();
				// submit the message
				$('#pseudoSubmit').focus().click();
			}
		});
	}

	function bindEnterToSendMessage() {
		// when the client hits ENTER
		$(my.messageInput).keypress(function(e) {
			if(e.which == 13) {
				$(this).blur();
				// submit the message
				$(my.submitButton).focus().click();
				$(my.messageInput).focus().click();
			}
		});
	}


	function showModalInterface() {
		$("#main").hide();
		$("#alertPseudo").hide();
		$('#pickUsername').show();
		$("#pseudoSubmit").text('Join');
		$("#pseudoSubmit").click(function() {
			// we set user's pseudonym here
			setPseudo();
		});

		$('#pseudoInput').focus().click();
		bindEnterToPseudoSubmit();
	}

	function setPseudo() {
		if ($("#pseudoInput").val() != "")
		{
			var proposed_username = $("#pseudoInput").val();

			// immediately give the user feedback, say we're loading
			var btn = $('#pseudoSubmit');
			btn.text('Loading...');

			// get the user's selected color & username
			my.color = $('#colorpicker').spectrum('get');
			my.socket.emit('joinattempt', my.roomName, proposed_username, my.color.toHex());
			
			my.socket.on('authresponse', function(data){
				if(data.status == "ok")
				{
					//set our pseudo to the server-approved value
					my.pseudonym = proposed_username;
					enterChatroom(my.pseudonym);
				}
				else
				{
					$('#alertPseudo').html(data.status);
					$("#alertPseudo").slideDown();
					btn.text('Join');
				}
			})
		}
	}

	function setConversationScroll(ignoreScrolledUp) {

		// if the user has scrolled up a bit (& no argument was passed to this function)
		if (ignoreScrolledUp === undefined && $(window).scrollTop() + $(window).height() < $(document).height()-150) {
			// dont scroll up - just indicate we're not at bottom
			if (my.scrolledToBottom) my.scrolledToBottom = false;
		}
		// otherwise, scroll down to the bottom
		else {
			window.scrollTo(0,document.body.scrollHeight);
		}
	}

	function findUserMentions(text, pseudo) {
		if (text.indexOf('@'+pseudo) != -1) {
			//play a sound
			notificationSound.play();
			//bold the mention
			return text.replace('@'+pseudo,'<strong>@'+pseudo+'</strong>');
		}
		return text;
	}

	function setupColorPicker() {

	        var startColor = my.colorpalette[Math.floor((Math.random()*2))][Math.floor((Math.random()*3))]

	        $("#colorpicker").spectrum({
                preferredFormat: "hex",
                showPaletteOnly: true,
	            showPalette:true,
	            clickoutFiresChange: true,
	            color: startColor,
		        palette: my.colorpalette
	        });

	}

	function updatePageTitle() {

		var title = my.roomName + " — dcom";

		if (!my.windowIsInFocus && my.unreadMessageCount > 0)	
			title += ' [' + my.unreadMessageCount + '] ';

		document.title = title;
	}

	function setupScrollListener() {
		// scroll listener
		$(window).scroll(function() {
			// if !scrolledToBottom but user has scrolled to bottom of page
			if (!my.scrolledToBottom && $(window).scrollTop() + $(window).height() == $(document).height()) {
		        my.scrolledToBottom=true;
		        my.unreadMessageCount = 0;
			}
		});
	}


	function windowFocusInit() {

		var hidden = "hidden";
	    // Standards:
	    if (hidden in document)
	        document.addEventListener("visibilitychange", onchange);
	    else if ((hidden = "mozHidden") in document)
	        document.addEventListener("mozvisibilitychange", onchange);
	    else if ((hidden = "webkitHidden") in document)
	        document.addEventListener("webkitvisibilitychange", onchange);
	    else if ((hidden = "msHidden") in document)
	        document.addEventListener("msvisibilitychange", onchange);
	    // IE 9 and lower:
	    else if ('onfocusin' in document)
	        document.onfocusin = document.onfocusout = onchange;
	    // All others:
	    else
	        window.onpageshow = window.onpagehide 
	            = window.onfocus = window.onblur = onchange;

	    function onchange (evt) {
	        var v = 'visible', h = 'hidden',
	            evtMap = { 
	                focus:v, focusin:v, pageshow:v, blur:h, focusout:h, pagehide:h 
	            };

	        evt = evt || window.event;

	        if (this[hidden]) {
	        	my.windowIsInFocus = false;
				my.unreadMessageCount = 0;
	        } else {
	        	my.windowIsInFocus = true;
	        	my.unreadMessageCount = 0;
	        	updatePageTitle();
	        }
	    }
	}

	// links come in here tagged with <a> </a> .. 
	// we find the image links and embed them in img tags
	function pullImagesFromLinks(text,div) {
		var exp = /(http|https):\/\/(www\.)?[\w-_\.]+\.[a-zA-Z]+\/((([\w-_\/]+)\/)?[\w-_\.]+\.(png|gif|jpg))/gi;
		var matches = text.match(exp);
		if (matches) {
			var pulledURL = matches[0];
			var img = new Image();
			img.src = pulledURL;
	        	img.onload = function() {
				//TODO: remove the original url
				// slap the new image on there
				div.append('<p><img src="' + pulledURL + '"">');
				// make color bar stretch to height of div
				setConversationScroll(false);
	 			div.find(".msgcolor").css('height',div.height()-14)
			}
		}
	}

	function setTimeAgo() {
		$("time").each(function(){
			var time = $.timeago($(this).attr('title'));
			$(this).text($.timeago($(this).attr('title'), 60));
		});
	}

	function selectAll(id)
	{
	    document.getElementById(id).focus();
	    document.getElementById(id).select();
	}

	function replaceURLWithHTMLLinks(text) {
	    var exp = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
	    return text.replace(exp,"<a href='$1' target='_blank'>$1</a>"); 
	}

	window.onresize = function(event) {
		setConversationScroll();
	};

})()