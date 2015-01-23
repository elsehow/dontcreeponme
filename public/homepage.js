function joinChatroom() {
       $('.alert').css('display','none');
	var chatroomName =$("#chatroomName").val();
	if (chatroomName.length > 0 && chatroomName.search(/[^a-zA-Z1-9]+/) === -1) {
		window.location = window.location + chatroomName
	} else {
		$('.alert').html('<strong>chatroom names can only have letters a-z and numbers, no spaces.</strong>').show(400);
	}
}


$(document).keydown(function(e){
    if (e.which === 13) {
	joinChatroom();
	}
});



$(document).ready(function(){
  $('a[href*=#]').click(function() {
    if (location.pathname.replace(/^\//,'') == this.pathname.replace(/^\//,'')
    && location.hostname == this.hostname) {
      var $target = $(this.hash);
      $target = $target.length && $target
      || $('[name=' + this.hash.slice(1) +']');
      if ($target.length) {
        var targetOffset = $target.offset().top;
        $('html,body')
        .animate({scrollTop: targetOffset}, 1000);
       return false;
      }
    }
  });
});


