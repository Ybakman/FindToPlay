var mongoose = require("mongoose");

var serverSchema = new mongoose.Schema({
    creator:String,   
	game : String ,
    lig : String,
    rol : [String],
    capacity : Number,
    fav : [String],
    lookRol :String,
    header :String,
    type:String,
    messages:[{
        message:String,
        user:String
    }],
    users : [
         {
        type : mongoose.Schema.Types.ObjectId,
        ref :"user"}
        ]
});

module.exports = mongoose.model("server", serverSchema);