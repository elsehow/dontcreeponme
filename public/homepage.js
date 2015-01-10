
function joinChatroom() {
	var regex =  new RegExp("/\s/");
	var chatroomName =$("#chatroomName").val();
	if (chatroomName.length > 0) {
		window.location = "https://dontcreepon.me/" + chatroomName
	} else {
		$('#alert').html('<strong>chatroom names can only have letters a-z and numbers, no spaces.</strong>');
	}
}

$(document).keydown(function(e){
    if (e.which === 13) {
	joinChatroom();
	}
});
