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