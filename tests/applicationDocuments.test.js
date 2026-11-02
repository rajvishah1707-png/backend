const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const ids={owner:'1'.repeat(24),other:'2'.repeat(24),admin:'3'.repeat(24),app:'4'.repeat(24),doc:'5'.repeat(24)};
let document,application,lastQuery,conflict,submitted;
function queryMatches(row,query){return Object.entries(query).every(([key,value])=>value && typeof value==='object' && '$in' in value ? value.$in.map(String).includes(String(row[key])) : String(row[key])===String(value));}
function promiseQuery(data){const result=Promise.resolve(data);result.select=()=>result;return result;}
function mock(path,exports){const id=require.resolve(path);require.cache[id]={id,filename:id,loaded:true,exports};}
mock('../models/DigitalDocument',{find:query=>{lastQuery=query;return promiseQuery(queryMatches(document,query)?[document]:[]);}});
mock('../models/ServiceApplication',{create:async value=>(submitted=value),findOne:async query=>queryMatches(application,query)?application:null,findOneAndUpdate:async(query,update)=>{if(conflict||!queryMatches(application,query))return null;Object.assign(application,update.$set);application.__v++;return application;}});
mock('../models/Service',{findById:async()=>({_id:'f'.repeat(24),status:'active',name:'Water',fees:'Free',requiredDocuments:['Identity Proof']})});
mock('../models/User',{findById:id=>promiseQuery({_id:id,id,role:id===ids.admin?'admin':'citizen',isActive:true})});
const {validateDocuments,ensureVerified,requirementsFor}=require('../utils/applicationDocuments');
const router=require('../routes/applicationDocumentRoutes');let server,url;
before(async()=>{process.env.JWT_SECRET='document-link-tests';const app=express();app.use(express.json());app.use('/applications',router);app.use('/applications',require('../routes/serviceApplicationRoutes'));server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));url=`http://127.0.0.1:${server.address().port}`;});
after(()=>new Promise(resolve=>server.close(resolve)));
beforeEach(()=>{conflict=false;document={_id:ids.doc,userId:ids.owner,status:'Pending',fileStorage:'database',documentTitle:'My identity'};application={_id:ids.app,userId:ids.owner,status:'Pending',__v:0,documentFlowVersion:1,documentRequirements:['Identity Proof'],documents:[{requirement:'Identity Proof',document:ids.doc}]};});
async function call(method='GET',user=ids.owner,body){const headers={'Content-Type':'application/json'};if(user)headers.Authorization=`Bearer ${jwt.sign({userId:user},process.env.JWT_SECRET)}`;const response=await fetch(`${url}/applications/${ids.app}/documents`,{method,headers,...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()};}
const selection=()=>[{requirement:'Identity Proof',document:ids.doc}];
test('service requirements are trimmed and deduplicated',()=>{assert.deepEqual(requirementsFor({requiredDocuments:[' Identity Proof ','Identity Proof','',null]}),['Identity Proof']);});
test('missing, duplicate, unknown and malformed document mappings are rejected',async()=>{for(const attachments of [[],[...selection(),...selection()],[{requirement:'Wrong label',document:ids.doc}],[{requirement:'Identity Proof',document:'bad'}]])await assert.rejects(validateDocuments(ids.owner,['Identity Proof'],attachments));});
test('ownership is checked in the database, not taken from request payload',async()=>{await assert.rejects(validateDocuments(ids.other,['Identity Proof'],selection()),/does not belong/);assert.equal(lastQuery.userId,ids.other);});
test('pending documents can be submitted, rejected files cannot',async()=>{assert.equal((await validateDocuments(ids.owner,['Identity Proof'],selection())).length,1);document.status='Rejected';await assert.rejects(validateDocuments(ids.owner,['Identity Proof'],selection()),/Replace rejected/);});
test('missing legacy files must be uploaded again',async()=>{document.fileStorage='disk';document.fileName='not-present-document.pdf';await assert.rejects(validateDocuments(ids.owner,['Identity Proof'],selection()),/unavailable/);});
test('approval requires all linked documents to be verified',async()=>{await assert.rejects(ensureVerified(application),/Verify all/);document.status='Verified';await ensureVerified(application);application.documents=[];await assert.rejects(ensureVerified(application),/missing/);});
test('legacy applications are not automatically blocked by invented historical requirements',async()=>{application.documentFlowVersion=0;await ensureVerified(application);});
test('only owner and admin can see application document metadata',async()=>{assert.equal((await call('GET',null)).status,401);assert.equal((await call('GET',ids.other)).status,404);assert.equal((await call('GET',ids.admin)).status,200);const own=await call();assert.equal(own.data.documents[0].document._id,ids.doc);assert(own.data.canEdit);});
test('document replacement is citizen-owned and blocked after approval',async()=>{assert.equal((await call('PATCH',ids.other,{documents:selection()})).status,404);assert.equal((await call('PATCH',ids.admin,{documents:selection()})).status,403);application.status='Approved';assert.equal((await call('PATCH',ids.owner,{documents:selection()})).status,409);});
test('rejected or pending applications can replace their documents without auto-approval',async()=>{application.status='Rejected';const response=await call('PATCH',ids.owner,{documents:selection()});assert.equal(response.status,200);assert.equal(application.status,'Rejected');assert.equal(application.documentFlowVersion,1);assert.equal(application.__v,1);});
test('concurrent application changes reject stale document edits',async()=>{conflict=true;assert.equal((await call('PATCH',ids.owner,{documents:selection()})).status,409);});

test('new application creation snapshots required documents and rejects omissions',async()=>{
    const headers={'Content-Type':'application/json',Authorization:`Bearer ${jwt.sign({userId:ids.owner},process.env.JWT_SECRET)}`};
    const payload={serviceId:'f'.repeat(24),serviceName:'Water'};
    const missing=await fetch(url+'/applications',{method:'POST',headers,body:JSON.stringify(payload)});
    assert.equal(missing.status,400);assert.match((await missing.json()).message,/Attach the required documents/);
    const valid=await fetch(url+'/applications',{method:'POST',headers,body:JSON.stringify({...payload,documents:selection()})});
    assert.equal(valid.status,201);assert.equal(submitted.documentFlowVersion,1);assert.deepEqual(submitted.documentRequirements,['Identity Proof']);assert.equal(submitted.documents[0].document,ids.doc);
});
