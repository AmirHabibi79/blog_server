const mongoose=require("mongoose");
const reqString={
    type:String,
    required:true,
}
const userSchema=new mongoose.Schema({
    username:reqString,
    password:reqString,
    posts:{
        type:Array
    }
})
userSchema.path("username").validate(async(username)=>{const count=await mongoose.models.Users.countDocuments({username});return count>0?false:true})

module.exports=mongoose.model("Users",userSchema);