const mongoose=require("mongoose")
const reqString={
    type:String,
    required:true,
}
const postSchema=new mongoose.Schema({
    title:reqString,
    body:reqString,
    user:String,
    createdAt:{
        type:Date,
        default:Date.now()
    },
    modifiedAt:{
        type:Date
    },
    comments:{
        type:Array,
            comment:{
                text:String,
                createdAt:{
                    type:Date,
                    default:Date.now()
                },
                qid:String
            }
    }
})

module.exports=mongoose.model("Posts",postSchema)