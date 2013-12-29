var starting_port = 4000;

function getPort(req, res) {
	
	return starting_port++;

}

exports.getPort = getPort;