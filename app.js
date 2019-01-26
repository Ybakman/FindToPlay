var express = require("express");
var app = express();
const ejsLint = require('ejs-lint');
var mongoose = require("mongoose");
var passport = require("passport");
var localStrategy = require("passport-local");
var passportLocalMongoose = require("passport-local-mongoose");
var User = require("./models/user");
var OurServer = require("./models/server");
var bodyParser = require("body-parser");
var server = app.listen(3000,function(){
	console.log("Server has Started");
});
var io = require("socket.io").listen(server);



app.set("view engine", "ejs");
mongoose.connect("mongodb://localhost/site_project");
app.use(bodyParser.urlencoded({extended: true}));
// Configuration login sign up stuffs

app.use(require("express-session")({
    secret: "My life is going on",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
passport.use(new localStrategy(User.authenticate()));
//Artık her giriş yapınca user req'in içinde req.user şeklinde

// her routea giderken current useri pushluyor sayfaya currentUser adıyla
app.use(function(req,res,next){
	res.locals.currentUser = req.user;
	next();
});

//sign up

app.get("/sign",function(req,res){
	res.render("sign");
});

app.post("/sign",function(req,res){
	var newUser = new User({
      mail : req.body.mail,
      username: req.body.username,
      dogumYılı: Number(req.body.dogumYılı),
      nick: req.body.nick,
      katıldı :0
	});
	User.register(newUser,req.body.password,function(err,user){
		if(err)
		{
			console.log(err);
			return res.render("/sign")
		}
		else
		{
			passport.authenticate("local")(req,res,function(){
				res.redirect("/");
			})
		}
	});
});

//Creating server

app.get("/lol/new",function(req,res){
	res.render("new");
});

app.post("/lol",function(req,res){
    var users = [req.user._id];
	var header = req.body.header;
	var game = "lol";
	var rol = [req.body.rol1,req.body.rol2];
	var capacity = Number(req.body.serverSize);
	var fav = req.body.fav;
	var type = req.body.type;
	var lookRol = req.body.lookRol;
	var lig = req.body.lig;
	var creator = req.user.username;
	var newServer = {users:users,header:header,game:game,rol:rol,capacity:capacity,fav:fav,type:type,lookRol:lookRol,lig:lig, creator:creator};
	OurServer.create(newServer,function(err,createdServer){
		if(err)
		{
			console.log(err);
		}
		else
		{
			User.findById(req.user._id,function(err,foundedUser){
				if(err)
				{
					console.log(err);
				}
				else
				{
					foundedUser.server = createdServer._id;
					foundedUser.save();
					console.log(createdServer);
				}
			});
			console.log(createdServer);
			var count = 0;
			res.redirect("/lol/servers/"+createdServer._id);
			var nsp = io.of('/lol/servers/'+createdServer._id);
			nsp.on('connection',function(socket){
				   socket.on("joined",function(data){
				   	User.findOne({username:data.user}, function(err, attendUser){
				   		if(err)
				   		{
				   			console.log(err);
				   		}
				   		else
				   		{
				   		}	
				   	});
				   nsp.emit("joined1",{user:data.user});
				});
				 count++;
	            console.log("Adam burada" + count);
	           socket.on('chat message',function(data){
	           	  var messageObject = {
	           	  	message:data.message,
	           	  	user:data.user
	           	  }
	           	   createdServer.messages.push(messageObject);
	           	   createdServer.save();
		          nsp.emit('chat message',{message:data.message, username:data.user});
	           });
	            socket.on("disconnect",function(){
	   	           count--;
	   	           console.log("adam gitti" + count);
	            });
	        }); 
		}
	});

});

//Joining the server

app.get("/lol/servers/:id",function(req,res){
     console.log(req.params.id);
     if(req.user)
     {
     	OurServer.findById(req.params.id,function(err,foundedServer){
		if(err)
		{
			console.log(err);
			res.redirect("/");
		}
		else{
			var count=0;
			res.render("chat",{server:foundedServer});
			/* nsp = io.of('/lol/servers/'+req.params.id);
			nsp.on('connection',function(socket){
				count++;
	            console.log("Adam burada" + count);
	            console.log(foundedServer.creator);
	            User.find({username:foundedServer.creator},function(err,foundedUser){
	            	if(err){
	            		console.log(err);
	            		console.log("SA OÇLAR")
	            	}
	            	else{
	            		console.log("SIKINTI YOK");
	            		console.log(foundedUser);
	            		nsp.emit("joined",{joinedUser:String(foundedUser.username)});
	            	}
	              });

			});*/
  		}
		});
     }
     else
     {
     	res.redirect("/login");
     }	
	
});

//Show All Servers

app.get("/lol/servers",function(req,res){
	OurServer.find({game:"lol"},function(err, foundedServers){
		if(err)
		{
			console.log(err);
			res.redirect("/");
		}
		else
		{
			res.render("servers",{servers:foundedServers}); 
		}	
	});
});


//Login

app.get("/login",function(req,res){
	res.render("login");
});


app.post("/login",passport.authenticate("local",{
	successRedirect:"/",
	failureRedirect: "/login"
}),function(req,res){});

//Logout

app.get("/logout",function(req,res){
	req.logout();
	res.redirect("/");
});


//Home Page
app.get("/",function(req,res){
	res.render("home");
});

app.use(express.static(__dirname + "/public"));



