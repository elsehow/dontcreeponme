var messageInput, submitButton, conversationContainer;
var windowIsInFocus = true; 
var scrolledToBottom = true;
var unreadMessageCount;
var my_color;
var current_userlist; //this is an object of [username,color]
var last_pseudo = ''; var last_date;
var password = null;

var notificationSound = new Audio('notify.ogg');

// Init
$(function() {

	windowFocusInit();
	window.setInterval(setTimeAgo, 1000*10);

	messageInput = $('#messageInput');
	submitButton = $("#submit");

	// setup interface for eliciting user's handle
	conversationContainer = $("#chatEntries")
	conversationContainer.empty();	
	$('#chatURL').val('dontcreepon.me'.concat(document.location.pathname));
	showModalInterface();

	// set focus to message input on all mouseup
	$('body').mouseup(function() {
		messageInput.focus()
	})

	setupColorPicker();
	setupScrollListener();
	submitButton.click(function() {sentMessage();});
});

//Socket.io
var socket = io.connect();

var pseudonym = '';

var roomName = document.location.pathname.split('/')[1];


// socket.on('connect', function() {
// });

socket.on('newuserlist', function(userlist) {
	refreshUserlist(userlist);
});

socket.on('announcement', function(data) {
	addMessage(data, '', new Date().toISOString(), false, true, false);

});

socket.on('message', function(data) {

	var from = data['pseudo'];
	var message = data['message']
	// don't show the message if it's from us
	// we add the client's own messages on sentMessage() instead
	if (from !== pseudonym) {
		if (password) {
			try { 
				message = sjcl.decrypt(password, message);
				addMessage(message, from, new Date().toISOString(), false, false,true);
			}
			// if the decryption doesnt work
			// they have the wrong key
			// add the message, even if its gibberish, but show that its not encrypted
			catch(e) {
				console.log(data['message']);
				addMessage(data['message'], from, new Date().toISOString(), false, false,false);
			}
		} else if (!password) {
			addMessage(message, from, new Date().toISOString(), false, false,false);
		}
	}

	// increment unread message count if window's not in focus
	if (!windowIsInFocus || !scrolledToBottom)  unreadMessageCount++;

	if (!windowIsInFocus) {
		updatePageTitle();
	} 
	//if (!scrolledToBottom) {
	//	updateMissedMessageDiv();
	//}
});


socket.on('disconnect', function() {
	//when server disconnects us, show user the modal interface
	showModalInterface();
})



//Help functions
function sentMessage() {
	if (messageInput.val() != "") 
	{
			var send_message = messageInput.val()
			if (password) {
				socket.emit('message',sjcl.encrypt(password, send_message))
				addMessage(send_message, pseudonym, new Date().toISOString(), true, false,true);
			} else {
				socket.emit('message',send_message);
				addMessage(send_message, pseudonym, new Date().toISOString(), true, false,false);
			}
			messageInput.val('');
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


function addMessage(msg, pseudo, date, fromSelf, isAnnouncement, isEncrypted) {

	//check msg for links
	msg = replaceURLWithHTMLLinks(msg);

	//check msg for mentions of user
	msg = findUserMentions(msg,pseudonym);

	if (isEncrypted) { var displayName = pseudo.replace('(encrypted)',' <i>(encrypted)</i>'); } else { var displayName = pseudo; }

	// if this is from the same person that sent the last message,
	// and the messages came close together
	// add to the last div
	if ((pseudo === last_pseudo) && (new Date(date) - new Date(last_date) < 50000)) {
		// get the last div
		var last_msg = $( "#chatEntries .message").last();
		last_msg.append("<p>" + msg + "</p>");
		// returns at most 1 image or video
		msg = pullImagesFromLinks(msg, last_msg);

	}

	// if not, add a new message to the div
	else {
		
		// create the message div 
		var divClass = "row message";
		if(fromSelf) divClass += " self";
		else if(isAnnouncement) divClass += " admin";

		var divString = '<div class="'+divClass+'">'

		if(fromSelf) {
			divString += '<div class = "msgcolor"></div><div class="meta">'+getDateDiv(date)+displayName+'</div>';
		} else if (isAnnouncement) {
			divString += '<div class="meta">'+getDateDiv(date)+'</div>';
		} else {
			divString += '<div class = "msgcolor"></div><div class="meta">'+displayName+getDateDiv(date)+'</div>';
		}

		divString+='<p>' + msg + '</p></div>';
		var div = $(divString);

		if (!isAnnouncement) {
			// set the tag color according to user color
			if (fromSelf) div.find(".msgcolor").css('background-color',my_color);
			else div.find(".msgcolor").css('background-color','#'+current_userlist[pseudo]);
		}

		conversationContainer.append(div);
		// returns at most 1 image or video
		msg = pullImagesFromLinks(msg,div);

	}

	last_pseudo = pseudo;
	last_date = date;

	setConversationScroll();

	setTimeAgo();
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
	$(messageInput).keypress(function(e) {
		if(e.which == 13) {
			$(this).blur();
			// submit the message
			$(submitButton).focus().click();
			$(messageInput).focus().click();
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
		if ($("#password").val().length > 0) {
			password = $("#password").val();
		}
		if (password) proposed_username += ' (encrypted)';

		socket.emit('joinattempt', roomName, proposed_username, my_color.toHex());
		
		socket.on('authresponse', function(data){
			if(data.status == "ok")
			{
				enterChatroom(proposed_username);
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
		if (scrolledToBottom) scrolledToBottom = false;
	}
	// otherwise, scroll down to the bottom
	else {
		window.scrollTo(0,document.body.scrollHeight);
	}
}

function updatePageTitle() {
	var title = '';

	if (!windowIsInFocus && unreadMessageCount > 0)	
		title += '[' + unreadMessageCount + '] ';
	
	title += roomName + " — dcom";

	document.title = title;
}

function updateMissedMessageDiv() {
	$('#missedMessages').show();
	if (unreadMessageCount == 1) $('#missedMessages').html('<p>1 new message</p>');
	else if (unreadMessageCount < 15) $('#missedMessages').html('<p>'+unreadMessageCount + ' new messages</p>');
	if (unreadMessageCount > 15) $('#missedMessages').html('<p>lots of new messages</p>');
}

function setTimeAgo() {
	$("time").each(function(){
		var time = $.timeago($(this).attr('title'));
		$(this).text($.timeago($(this).attr('title'), 60));
	});
}

function replaceURLWithHTMLLinks(text) {
    var exp = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    return text.replace(exp,"<a href='$1' target='_blank'>$1</a>"); 
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
			setConversationScroll(false);
		}
	}
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
        	windowIsInFocus = false;
		unreadMessageCount = 0;
        } else {
        	windowIsInFocus = true;
        	unreadMessageCount = 0;
        	updatePageTitle();
        }
    }
}


function enterChatroom(proposed_username) {

	//set our pseudo to the server-approved value
	pseudonym = proposed_username;

	// we are in, hide the modal interface
	$('#pickUsername').hide();
	// show chat window
	$("#main").show();
	// bind enter to send
	bindEnterToSendMessage();
	// highlight the text entry field
	$(messageInput).focus().click();
	// turn page title into chatroom name
	updatePageTitle();
}

function setupColorPicker() {

	var colorpalette =  [
                ['#FF0000', '#E8E712', '#7EE8D1'],
                ['#0002E8','#EB2FFF', '#FF730A'],
        ];

        var startColor = colorpalette[Math.floor((Math.random()*2))][Math.floor((Math.random()*3))]

        $("#colorpicker").spectrum({
                preferredFormat: "hex",
                showPaletteOnly: true,
            showPalette:true,
            clickoutFiresChange: true,
            color: startColor,
        palette: colorpalette

        });

}

function setupScrollListener() {
        // scroll listener
        $(window).scroll(function() {
                // if !scrolledToBottom but user has scrolled to bottom of page
                if (!scrolledToBottom && $(window).scrollTop() + $(window).height() == $(document).height()) {
                        scrolledToBottom=true;
                        unreadMessageCount = 0;
                        $('#missedMessages').hide().empty();
                }
        });
}

function selectAll(id)
{
    document.getElementById(id).focus();
    document.getElementById(id).select();
}
