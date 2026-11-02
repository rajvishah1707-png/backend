const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express=require('express');
let server,url;
before(async()=>{const app=express();app.use(express.json());app.use('/api/ai',require('../routes/aiRoutes'));server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));url=`http://127.0.0.1:${server.address().port}/api/ai/chat`;});
after(()=>new Promise(resolve=>server.close(resolve)));
async function ask(message){const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message})});return {status:res.status,data:await res.json()};}
test('greeting still works without any external AI key',async()=>{const res=await ask('Hi!');assert.equal(res.status,200);assert.match(res.data.reply,/Welcome to the Smart City/);});
test('hi inside this no longer steals payment or service questions',async()=>{const res=await ask('This payment has failed');assert.equal(res.status,200);assert.match(res.data.reply,/Payments section/);assert.match(res.data.reply,/approved/);assert.match(res.data.reply,/Test Mode/);assert(!res.data.reply.startsWith('Hello'));});
test('quick-question topics have usable replies',async()=>{for(const [question,expected] of [['What city services are available?',/City Services/],['How can I apply for a service?',/Apply Now/],['How can I track my application?',/Under Review/],['How can I submit a complaint?',/My Complaints/],['What can I do with digital documents?',/Digital Documents/]]){const res=await ask(question);assert.equal(res.status,200);assert.match(res.data.reply,expected);assert(!res.data.reply.includes('**'));}});
test('empty, non-string and overlong questions are rejected',async()=>{for(const message of ['', '   ', 10, {}, 'x'.repeat(2001)])assert.equal((await ask(message)).status,400);});
