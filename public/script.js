var messageContainer, submitButton, conversationContainer;
var windowIsInFocus = true; 
var pullLinks = true;
var unreadMessageCount;
var my_color;
var current_userlist; //this is an object of [username,color]
var last_pseudo = ''; var last_date;

var password = null;

var notificationSound = new Audio('notify.ogg');

// Init
$(function() {


	windowFocusInit();

	messageContainer = $('#messageInput');
	submitButton = $("#submit");
	conversationContainer = $("#chatEntries")
	bindSendButton();
	window.setInterval(time, 1000*10);

	// set focus to message container on all mouseup
	$('body').mouseup(function() {
		messageContainer.focus()
	})

	// setup interface for eliciting user's handle
	conversationContainer.empty();	
	showModalInterface();
	var colorpalette =  [
    		['06017F', '030040', '0D01FF'],
    		['48047F', '240240', '9009FF'],
    		['7F0008', '400004', 'FF0010'],
    		['402A0A', 'FD2CFF', 'FFE637'],
    		['A6FF00', '00F0FF', '00FF10'],
    		['B9C5FF', 'CBFFA0', 'CC836C'],
    		['5EB289', 'B9FFDD', '6107B2']
	];
	
	var startColor = colorpalette[Math.floor((Math.random()*7))][Math.floor((Math.random()*3))]

	$("#colorpicker").spectrum({
		preferredFormat: "hex",
		showPaletteOnly: true,
	    showPalette:true, 
	    clickoutFiresChange: true,
	    color: startColor,
    	palette: colorpalette
    	
	});

	// set up scrolling conversation window
	submitButton.click(function() {sentMessage();});
});

//Socket.io
var socket = io.connect();

var pseudonym = '';

var roomName = document.location.pathname.split('/')[1];


socket.on('connect', function() {
});

socket.on('newuserlist', function(msg) {
	refreshUserlist(msg.userlist);
});

socket.on('message', function(data) {

	var from = data['pseudo'];
	var message = data['message']
	if (password && from !== '((Lord DCOM bot))') {
		message = sjcl.decrypt(password, message);
	}

	// special styling if it's an admin announcement (someone joining/leaving room fx)
	if (from === '((Lord DCOM bot))')
		addMessage(message, from, new Date().toISOString(), false, true, false);

	// don't show the message if it's from us
	// we add the client's own messages on sentMessage() instead
	else if (from !== pseudonym) {
		if (password) {
			addMessage(message, from, new Date().toISOString(), false, false,true);
		} else {
			addMessage(message, from, new Date().toISOString(), false, false,false);
		}
	}
	

	// increment unread message count if window's not in focus
	if (!windowIsInFocus) {
		unreadMessageCount++;
		updatePageTitle();
	}
});


socket.on('disconnect', function() {
	//when server disconnects us, show user the modal interface
	showModalInterface();
})

//Help functions
function sentMessage() {
	if (messageContainer.val() != "") 
	{
			var send_message = messageContainer.val()
			if (password) {
				socket.emit('message',sjcl.encrypt(password, send_message))
				addMessage(send_message, pseudonym, new Date().toISOString(), true, false,true);
			} else {
				socket.emit('message',send_message);
				addMessage(send_message, pseudonym, new Date().toISOString(), true, false,false);
			}
			messageContainer.val('');
			submitButton.button('loading');
		
	}
}

function refreshUserlist(usersobject) { //we need to keep usersobject as current_userlist
	current_userlist = usersobject;

	var count = 0;
	var userlistDiv = $('#userlistDiv');
	userlistDiv.empty();

	//userlistDiv.text('here: ');


	$.each(current_userlist,function(username,color)  {

		if (username) {
			count++;
			var user_text = $('<span>' + username + ' </span>').css('color','#'+color);
			userlistDiv.append(user_text);
		}

	});


}


function addMessage(msg, pseudo, date, self, admin, isEncrypted) {

	//check msg for links
	msg = replaceURLWithHTMLLinks(msg);

	//check msg for mentions of user
	msg = findUserMentions(msg,pseudonym);

	if (isEncrypted) { var display = pseudo+' <i>(encrypted)</i>'; } else { var display = pseudo; }

	// each of these functions turns at most 1 image or video
	// so, users get at most 1 video and 1 image (gif,jpeg and so on)
	if (pullLinks) { msg = pullImagesFromLinks(msg); } //msg = pullVideosFromLinks(msg); }

	// if this is from the same person that sent the last message,
	// and the messages came close together
	// add to the last div
	if ((pseudo === last_pseudo) && (new Date(date) - new Date(last_date) < 50000)) {
		// get the last div
		var last_msg = $( "#chatEntries .message").last();
		last_msg.append("<p>" + msg + "</p>");
	}

	// if not, add a new message to the div
	else {
		
		// create the message div 
		if(self) var classDiv = "row message self";
		else if(admin) var classDiv = "row message admin";
		else var classDiv = "row message";

		if(self) {
			var div = $('<div class="'+classDiv+'"><div class = "msgcolor"></div><div class="meta"><time class="date" title="'+date+'">'+date+'</time>'+display+'</div><p>' + msg + '</p></div>');

		} else {
			var div = $('<div class="'+classDiv+'"><div class = "msgcolor"></div><div class="meta">'+display+' <time class="date" title="'+date+'">'+date+'</time></div><p>' + msg + '</p></div>');
		}
		if (!admin) {
			// set the tag color according to user color
			if (self) div.find(".msgcolor").css('background-color',my_color);
			else div.find(".msgcolor").css('background-color','#'+current_userlist[pseudo]);
		}

		conversationContainer.append(div);
	}

	last_pseudo = pseudo;
	last_date = date;

	setConversationScroll();

	time();
}


function clearScreen() {
	conversationContainer.empty();	
	addMessage('cleared screen', '((Lord DCOM Bot))', new Date().toISOString(), false, true, false);
}



function bindSendButton() {
	submitButton.button('loading');
	messageContainer.on('input', function() {
		if (messageContainer.val() == "") submitButton.button('loading');
		else submitButton.button('reset');
	});
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
	$(messageContainer).keypress(function(e) {
		if(e.which == 13) {
			$(this).blur();
			// submit the message
			$(submitButton).focus().click();
			$(messageContainer).focus().click();
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
		// immediately give the user feedback, say we're loading
		var btn = $('#pseudoSubmit');
		btn.text('Loading...');
		btn.disabled = true;

		// get the user's selected color & username
		my_color = $('#colorpicker').spectrum('get');
		var proposed_username = $("#pseudoInput").val();

		socket.emit('joinattempt', roomName, proposed_username, my_color.toHex());
		
		socket.on('authresponse', function(data){
			if(data.status == "ok")
			{
				enterChatroom(proposed_username);
				if ($("#password").val().length > 0) {
					password = $("#password").val();
				}
			}
			else
			{
				$('#alertPseudo').html(data.status);
				$("#alertPseudo").slideDown();
			}
		})
	}
}


function setConversationScroll() {
	window.scrollTo(0,document.body.scrollHeight);
}

function updatePageTitle() {
	var title = '';

	if (!windowIsInFocus && unreadMessageCount > 0)	
		title += '[' + unreadMessageCount + '] ';
	
	title += roomName + " — dcom";

	document.title = title;
}

function time() {
	$("time").each(function(){
		var time = $.timeago($(this).attr('title'));
		$(this).text($.timeago($(this).attr('title'), 60));
	});
}

function is_expired(date_str) {

    if (date_str === '6 minutes ago') {
    	return true; 
    }

    return false;
};

function replaceURLWithHTMLLinks(text) {
    var exp = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    return text.replace(exp,"<a href='$1' target='_blank'>$1</a>"); 
}

function findUserMentions(text, pseudo) {
	if (text.indexOf('@'+pseudo) != -1) {
		//play a sound
		notificationSound.play()
		//bold the mention
		return text.replace('@'+pseudo,'<strong>@'+pseudo+'</strong>');
	}
	return text
}

// links come in here tagged with <a> </a> .. 
// we find the image links and embed them in img tags
function pullImagesFromLinks(text) {
	var exp = /(http|https):\/\/(www\.)?[\w-_\.]+\.[a-zA-Z]+\/((([\w-_\/]+)\/)?[\w-_\.]+\.(png|gif|jpg))/gi;
	var matches = text.match(exp);
	if (matches) {
		var pulled_URL = matches[0];
		//return text + '<p><img src="' + pulled_URL + '"">';
		return '<p><img src="' + pulled_URL + '"">'; // just the embed, no url
	}
	return text;
}

//function pullVideosFromLinks(text) {
//	var videoid = text.match(/(?:https?:\/{2})?(?:w{3}\.)?youtu(?:be)?\.(?:com|be)(?:\/watch\?v=|\/)([^\s&]+)/);
//	if(videoid != null) 
//		//return text + '<p><iframe title="YouTube video player" class="youtube-player" type="text/html" width="480" height="360" src="https://www.youtube.com/embed/' + videoid[1] + '"frameborder="0" allowFullScreen></iframe>';
//		return '<p><iframe width="480" height="360" src="//www.youtube.com/embed/' + videoid[1] + '"frameborder="0" allowFullScreen></iframe>';
//	
//	return text;
//}

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
        	windowIsInFocus = false;
        	unreadMessageCount = 0;
        } else {
        	windowIsInFocus = true;
        	unreadMessageCount = 0;
        	updatePageTitle();
        }
    }
}

$( window ).resize(function() {
});

function setupSettingsMenu() {
	var drop;

	drop = new Drop({

	  target: $('.drop-target'),

	  content: 'Welcome to the future!',

	  position: 'bottom left',

	  openOn: 'click'

	});
}

function enterChatroom(proposed_username) {

	//set our pseudo to the server-approved value
	pseudonym = proposed_username;

	// we are in, hide the modal interface
	$('#pickUsername').hide();
	$("#alertPseudo").hide();
	// show chat window
	$("#main").show();
	// bind enter to send
	bindEnterToSendMessage();
	// highlight the text entry field
	$(messageContainer).focus().click();
	// turn page title into chatroom name
	updatePageTitle();
}
