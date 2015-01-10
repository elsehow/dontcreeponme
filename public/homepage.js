

function joinChatroom() {
       $('.alert').css('display','none');
	var chatroomName =$("#chatroomName").val();
	if (chatroomName.length > 0 && chatroomName.search(/[^a-zA-Z1-9]+/) === -1) {
		window.location = "https://dontcreepon.me/" + chatroomName
	} else {
		$('.alert').html('<strong>chatroom names can only have letters a-z and numbers, no spaces.</strong>').show(400);
	}
}


$(document).keydown(function(e){
    if (e.which === 13) {
	joinChatroom();
	}
});
