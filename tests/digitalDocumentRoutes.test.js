const { test,before,after,beforeEach }=require('node:test');
const assert=require('node:assert/strict');
const express=require('express'),jwt=require('jsonwebtoken');
const ids={owner:'6'.repeat(24),other:'7'.repeat(24),admin:'8'.repeat(24),doc:'9'.repeat(24)};
let stored,linked,deleted;
const bytes=Buffer.from('%PDF-1.4\nTest document');
function query(result){const p=Promise.resolve(result);p.select=()=>p;return p;}
function mock(path,exports){const id=require.resolve(path);require.cache[id]={id,filename:id,loaded:true,exports};}
mock('../models/User',{findById:id=>query({_id:id,id,name:'Citizen',email:'test@example.com',role:id===ids.admin?'admin':'citizen',isActive:true})});
mock('../models/ServiceApplication',{exists:async()=>linked});
const Model=require('../models/DigitalDocument');
Model.create=async data=>(stored=new Model({_id:ids.doc,...data}));
Model.findOne=filter=>query(stored && (!filter.userId||String(filter.userId)===String(stored.userId))?stored:null);
Model.findById=()=>query(stored);
Model.deleteOne=async()=>{deleted=true;};
const router=require('../routes/digitalDocumentRoutes');let server,url;
before(async()=>{process.env.JWT_SECRET='private-file-tests';const app=express();app.use(express.json());app.use('/documents',router);server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));url=`http://127.0.0.1:${server.address().port}`;});
after(()=>new Promise(resolve=>server.close(resolve)));
beforeEach(()=>{stored=null;linked=false;deleted=false;});
const auth=id=>({Authorization:`Bearer ${jwt.sign({userId:id},process.env.JWT_SECRET)}`});
async function upload(file=bytes,type='application/pdf'){const data=new FormData();data.append('document',new Blob([file],{type}),'identity.pdf');data.append('documentType','Identity Proof');data.append('documentTitle','My Identity');return fetch(url+'/documents',{method:'POST',headers:auth(ids.owner),body:data});}
test('uploads store private bytes and never serialize them in API metadata',async()=>{const response=await upload();assert.equal(response.status,201);const data=await response.json();assert.equal(stored.fileStorage,'database');assert(stored.fileData.equals(bytes));assert(!('fileData' in data.document));assert(!('fileData' in stored.toJSON()));assert.equal(stored.citizenEmail,'test@example.com');});
test('file content must match its advertised MIME type',async()=>{assert.equal((await upload(Buffer.from('<html>fake document</html>'))).status,400);assert.equal(stored,null);});
test('new file downloads work without local disk and require owner/admin authentication',async()=>{await upload();const path=url+`/documents/file/${stored.fileName}`;assert.equal((await fetch(path)).status,401);assert.equal((await fetch(path,{headers:auth(ids.other)})).status,403);for(const user of [ids.owner,ids.admin]){const response=await fetch(path,{headers:auth(user)});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.get('content-type'),'application/pdf');assert(Buffer.from(await response.arrayBuffer()).equals(bytes));}});
test('both admin and citizen deletion retain linked documents',async()=>{await upload();linked=true;for(const [route,user] of [[`/${ids.doc}`,ids.owner],[`/admin/${ids.doc}`,ids.admin]]){const response=await fetch(url+'/documents'+route,{method:'DELETE',headers:auth(user)});assert.equal(response.status,409);}assert(!deleted);});
test('citizen cannot delete another citizen document',async()=>{await upload();const response=await fetch(url+`/documents/${ids.doc}`,{method:'DELETE',headers:auth(ids.other)});assert.equal(response.status,404);assert(!deleted);});
test('a referenced approved document cannot be rejected',async()=>{await upload();linked=true;const response=await fetch(url+`/documents/admin/${ids.doc}/reject`,{method:'PATCH',headers:{...auth(ids.admin),'Content-Type':'application/json'},body:JSON.stringify({adminRemark:'Reject'})});assert.equal(response.status,409);});
