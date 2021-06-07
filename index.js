require("dotenv").config()
const express=require("express")
const app=express()
const mongoose=require("mongoose")
const session=require("express-session")
const mongoSession=require("connect-mongodb-session")(session);
const User=require("./modules/user")
const Post=require("./modules/post")
const bodyParser=require("body-parser")
const argon=require("argon2")
const validator=(err)=>{
    const values=Object.values(err.errors)
        const errors=values.map(err=>{
            err.kind==="user defined"?err.kind="username already exists":""
            return{type:"error",kind:err.kind,path:err.path}
        })
        return errors
}
const store=new mongoSession({
    uri:process.env.DB_PATH,
    collection:"sessions",
    expires:parseInt(process.env.COOKIE_EXPIRES)
})
const isloged=async(req,res,next)=>{
    if(!req.session.qid){
        res.status(400).send({type:"error",kind:"you are not authorized"})
    }else{
        if(!mongoose.Types.ObjectId.isValid(req.session.qid))
        {
           
            res.status(400).send({type:"error",kind:"you are not authorized"})
            return
        }
        const user=await User.findById({_id:req.session.qid})
        if(!user){
            
            res.status(400).send({type:"error",kind:"you are not authorized"})
            return
        }
        next()
    }
}
app.use(bodyParser({extended:false}))
// for CORS requests with credentials
app.use((req,res,next)=>{
    res.set("Access-Control-Allow-Origin",req.headers.origin)
    res.set("Access-Control-Allow-Credentials",true)
    res.set("Access-Control-Allow-Headers","content-type")
    res.set("Access-Control-Allow-Methods","GET,POST,DELETE,PUT")
    next()
})

app.use(session({
    name:process.env.COOKIE_NAME,
    secret:process.env.SECRET,
    resave:false,
    saveUninitialized:false,
    store:store
}))
mongoose.connect(process.env.DB_PATH,{useUnifiedTopology: true,useNewUrlParser: true},(err)=>{
    if(err)
    throw new Error(err)
    else
    console.log("connected to db")
})
app.get("/getusername",isloged,async(req,res)=>{
    
    const {qid}=req.session
    const user=await User.findById({_id:qid})
    res.send({username:user.username})
})

app.post("/register",async(req,res)=>{
    const {username,password}=req.body
    if(!username){
        res.status(400).send({type:"error",kind:"username must contain letters",path:"username"})
        return
    }
    if(!password){
        res.status(400).send({type:"error",kind:"password must contain letters",path:"password"})
        return
    }
    const user=await User.findOne({username:username})
    if(user){
        res.status(400).send({type:"error",kind:"user already exists",path:"username"})
        return
    }
    const hash=await argon.hash(password)
    const newUser=await User.create({
        username:username,
        password:hash
    })
    req.session.qid=newUser._id
    req.session.cookie.maxAge=parseInt(process.env.COOKIE_EXPIRES)
    res.send({username:newUser.username})
    

})
app.delete("/logout",(req,res)=>{
    req.session.destroy()
    res.send({message:"logout"})
})
app.post("/login",async(req,res)=>{
    const {username,password}=req.body
    if(!username){
        res.status(400).send({type:"error",kind:"username must contain letters",path:"username"})
        return
    }
    if(!password){
        res.status(400).send({type:"error",kind:"password must contain letters",path:"password"})
        return
    }
    const user=await User.findOne({username:username})
    if(!user)
    {
        res.status(400).send({type:"error",kind:"user not found",path:"username"})
        return
    }
    if(req.session.qid)
    {
        res.status(400).send({type:"error",kind:"you are loged in",path:"username"})
        return
    }
    const unhash=await argon.verify(user.password,password)
    if(!unhash)
    {
        res.send({type:"error",kind:"password is not corroct",path:"password"})
        return
    }
    req.session.qid=user._id
    req.session.cookie.maxAge=parseInt(process.env.COOKIE_EXPIRES)
    res.send({username:user.username})
})
app.get("/post/:view",async(req,res)=>{
    const view=parseInt(req.params.view)*10
    const posts=await Post.find({},{comments:0}).skip(view).limit(10)
    let data
    data=await Promise.all(posts.map(async(post)=>{
        const user=await User.findOne({_id:post.user})
        post.user=user.username
        post.__v=undefined
        return  post
    }))
    
    res.send(data)
    
})
app.get("/postview/:id",async(req,res)=>{
    const {id}=req.params
    const post=await Post.findOne({_id:id})
    if(!post){
        res.send({type:"error",kind:"post doesnt exist"})
        return
    }
    const comments=await Promise.all(post.comments.map(async(comment)=>{
        const {qid,text,createdAt}=comment
        const user= await User.findOne({_id:qid})
        return {text:text,createdAt:createdAt,user:user.username}
    }))
    const {username}=await User.findById({_id:post.user})
    post.comments=comments
    post.user=username
    post.__v=undefined
    res.send(post)
})
app.get("/user/posts",isloged,async(req,res)=>{
    const {qid}=req.session
    const user=await User.findOne({_id:qid})
    const posts= await Promise.all(user.posts.map(async(post)=>{
        const {body,title,createdAt,modifiedAt,_id}=await Post.findOne({_id:post})
        return{body:body,title:title,createdAt:createdAt,modifiedAt:modifiedAt,_id:_id}
    }))
    res.send(posts)
})
app.post("/post/create",isloged,async(req,res)=>{
    const {title,body}=req.body
    const {qid}=req.session
    if(!title)
        {
            res.status(400).send({type:"error",kind:"title must contain letters",path:"title"})
            return
        }
    if(!body)
    {
        res.status(400).send({type:"error",kind:"body must contain letters",path:"body"})
            return
    }
    const post=await Post.create({
        title:title,
        body:body,
        user:qid
    })
    await User.updateOne({_id:qid},{$push:{posts:post._id}})
    res.send({message:"ok"})
})
app.put("/post/:id",isloged,async(req,res)=>{
    const {title,body}=req.body
    const {id}=req.params
    if(!title)
        {
            res.status(400).send({type:"error",kind:"title must contain letters",path:"title"})
            return
        }
    if(!body)
    {
        res.status(400).send({type:"error",kind:"body must contain letters",path:"body"})
            return
    }
    if(!mongoose.Types.ObjectId.isValid(id))
    {
        res.status(400).send({type:"error",kind:"post doesnt exist",path:"title"})
        return
    }
    const post= await Post.findOne({_id:id})
    if(!post)
    {
        res.status(400).send({type:"error",kind:"post doesnt exist",path:"title"})
        return
    }
    if(post.user!==req.session.qid.toString())
    {
        res.status(400).send({type:"error",kind:"you cant edit this post"})
        return
    }
    const modifiedAt=Date.now()
    await Post.updateOne({_id:id},{title:title,body:body,modifiedAt:modifiedAt})
    res.send({message:"ok"})
})
app.delete("/post/:id",async(req,res)=>{
    const {id}=req.params
    if(!mongoose.Types.ObjectId.isValid(id))
    {
        res.status(400).send({type:"error",kind:"post doesnt exist"})
        return
    }
    const post= await Post.findOne({_id:id})
    if(!post)
    {
        res.status(400).send({type:"error",kind:"post doesnt exist"})
        return
    }
    if(post.user!==req.session.qid.toString())
    {
        res.status(400).send({type:"error",kind:"you cant delete this post"})
        return
    }
    const {posts}=await User.findOne({_id:req.session.qid})
    const newPosts= await Promise.all(posts.filter(post=>{return post.toString()!==id}))
    await User.updateOne({_id:req.session.qid},{posts:newPosts})
    await post.delete()
    res.send({message:"deleted"})
    
})
app.post("/comment/add",isloged,async(req,res)=>{
    const {text,postid}=req.body
    const {qid}=req.session
    if(!text)
    {
        res.status(400).send({type:"error",kind:"text must contain letters",path:"text"})
        return
    }
    if(!postid)
    {
        res.status(400).send({type:"error",kind:"post doesnt exist",path:"text"})
        return
    }
    if(!mongoose.Types.ObjectId.isValid(postid))
    {
        res.status(400).send({type:"error",kind:"post doesnt exist",path:"text"})
        return
    }
    const post=await Post.findOne({_id:postid})
    if(!post)
    {
        res.status(400).send({type:"error",kind:"post doesnt exist",path:"text"})
        return
    }
    const createdAt=Date.now()
    const {username}=await User.findById({_id:qid})
    await post.update({$push:{comments:{text,createdAt,qid}}})
    res.send({text:text,createAt:createdAt,user:username})

})
app.listen(process.env.PORT,()=>{
    console.log("server running on "+process.env.PORT)
})