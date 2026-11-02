const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const express = require('express');
const citizen='1'.repeat(24),admin='2'.repeat(24),categoryId='3'.repeat(24),feedbackId='4'.repeat(24);
let createdNotification,reply;
function mock(path,value){const id=require.resolve(path);require.cache[id]={id,filename:id,loaded:true,exports:value};}
mock('../models/User',{findById:id=>{const p=Promise.resolve({_id:id,id,role:id===admin?'admin':'citizen',isActive:true});p.select=()=>p;return p;},findOne:async q=>q._id===citizen?{_id:citizen,role:'citizen'}:null});
mock('../models/Service',{distinct:async()=>['Utilities'],exists:async q=>q.category==='Utilities'});
mock('../models/Category',{find:()=>({sort:()=>({lean:async()=>[]})}),findOne:async()=>null,findById:async()=>({_id:categoryId,name:'Utilities'}),create:async x=>x});
mock('../models/Notification',{create:async value=>(createdNotification=value)});
mock('../models/Feedback',{create:async x=>x,findByIdAndUpdate:async(id,data)=>{reply=data.$set;return {_id:id,...reply};}});
const management=require('../routes/managementRoutes'),feedback=require('../routes/feedbackRoutes');let server,url;
before(async()=>{process.env.JWT_SECRET='management-test';const app=express();app.use(express.json());app.use('/admin',management);app.use('/feedback',feedback);server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));url=`http://127.0.0.1:${server.address().port}`;});
after(()=>new Promise(resolve=>server.close(resolve)));
async function call(path,method='GET',body,user=admin){const headers={'Content-Type':'application/json'};if(user)headers.Authorization=`Bearer ${jwt.sign({userId:user},process.env.JWT_SECRET)}`;const res=await fetch(url+path,{method,headers,...(body?{body:JSON.stringify(body)}:{})});return {status:res.status,data:await res.json()};}
test('management modules require authenticated admin role',async()=>{assert.equal((await call('/admin/categories','GET',null,null)).status,401);assert.equal((await call('/admin/categories','GET',null,citizen)).status,403);});
test('category list includes categories already used by existing services',async()=>{const res=await call('/admin/categories');assert.equal(res.status,200);assert.equal(res.data.categories[0].name,'Utilities');assert(res.data.categories[0].inUse);});
test('in-use categories cannot be deleted or renamed',async()=>{assert.equal((await call(`/admin/categories/${categoryId}`,'DELETE')).status,409);assert.equal((await call(`/admin/categories/${categoryId}`,'PUT',{name:'Changed'})).status,409);});
test('new duplicate service category names are rejected',async()=>{assert.equal((await call('/admin/categories','POST',{name:'Utilities'})).status,409);assert.equal((await call('/admin/categories','POST',{name:'Parks'})).status,201);});
test('notification targets must be actual citizens and content is validated',async()=>{assert.equal((await call('/admin/notifications','POST',{title:'Update',message:'Details',userId:admin})).status,404);const res=await call('/admin/notifications','POST',{title:'Update',message:'Details',userId:citizen});assert.equal(res.status,201);assert.equal(createdNotification.userId,citizen);assert.equal(createdNotification.type,'General');});
test('feedback uses authenticated owner and rejects invalid ratings',async()=>{assert.equal((await call('/feedback','POST',{rating:6,message:'Test'},citizen)).status,400);const res=await call('/feedback','POST',{rating:5,message:'Test',userId:admin},citizen);assert.equal(res.status,201);assert.equal(res.data.feedback.userId,citizen);});
test('admin replies persist with reply time',async()=>{const res=await call(`/admin/feedback/${feedbackId}`,'PATCH',{adminReply:'Thank you'});assert.equal(res.status,200);assert.equal(reply.adminReply,'Thank you');assert(reply.repliedAt instanceof Date);});
