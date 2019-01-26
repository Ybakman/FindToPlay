var mongoose = require("mongoose");
var passportLocalMongoose = require("passport-local-mongoose");


var userSchema = new mongoose.Schema({
	mail : String,
	username : String,
	password: String,
	dogumYılı : Number,
	server : {
		type : mongoose.Schema.Types.ObjectId,
		ref :"server"
	}

});

userSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("user", userSchema);