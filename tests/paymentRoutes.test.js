const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const ids = { citizen:'a'.repeat(24), other:'b'.repeat(24), admin:'c'.repeat(24), app:'d'.repeat(24), payment:'e'.repeat(24) };
let records, application, requests, paidItems, appQuery, submitted, service;
function matches(row, filter) {
    return Object.entries(filter).every(([key,value]) => {
        if (value && typeof value === 'object') {
            if ('$ne' in value) return row[key] !== value.$ne;
            if ('$exists' in value) return (row[key] !== undefined) === value.$exists;
            if ('$in' in value) return value.$in.includes(row[key]);
        }
        return String(row[key]) === String(value);
    });
}
const Payment = {
    async findOne(filter) { return records.find(row => matches(row,filter)) || null; },
    async findById(id) { return this.findOne({ _id:id }); },
    async findOneAndUpdate(filter, update, options = {}) {
        let row = await this.findOne(filter);
        if (!row && options.upsert) { row = { _id:ids.payment, ...filter, ...update.$setOnInsert }; records.push(row); }
        if (!row) return null;
        Object.assign(row,update.$set || {}); for (const [key,value] of Object.entries(update.$max || {})) row[key]=Math.max(row[key] || 0,value); return row;
    },
    async findByIdAndUpdate(id, update) { return this.findOneAndUpdate({ _id:id },update); },
    async updateOne(filter, update) { return this.findOneAndUpdate(filter,update); },
    async exists(filter) { return Boolean(await this.findOne(filter)); }
};
const Application = {
    async create(payload) { submitted=payload;return payload; },
    async findOne(query) { appQuery=query; return matches(application,query) ? application : null; },
    async findById(id) { return id === ids.app ? application : null; },
    async findOneAndUpdate(query,update) {
        if (!matches(application,query)) return null;
        Object.assign(application,update.$set); return application;
    }
};
const users = {
    [ids.citizen]:{ _id:ids.citizen,id:ids.citizen,role:'citizen',isActive:true },
    [ids.other]:{ _id:ids.other,id:ids.other,role:'citizen',isActive:true },
    [ids.admin]:{ _id:ids.admin,id:ids.admin,role:'admin',isActive:true }
};
function mock(path, value) { require.cache[require.resolve(path)] = { id:require.resolve(path), filename:require.resolve(path), loaded:true, exports:value }; }
mock('../models/Service',{ findById:async()=>service });
mock('../models/Payment',Payment);mock('../models/ServiceApplication',Application);
mock('../models/User',{ findById:id => { const promise=Promise.resolve(users[id] || null);promise.select=()=>promise;return promise; } });
const gateway = require('../utils/razorpayClient');
gateway.request = async (path,method,body) => {
    requests.push({ path,method,body });
    if (path === 'orders') return { id:'order_test1',amount:body.amount,currency:'INR' };
    if (path.endsWith('/payments')) return { items:paidItems };
    if (path.startsWith('payments/')) return paidItems[0] || { status:'authorized' };
    return {};
};
const originalGatewayRequest = gateway.request;
const { router, webhook, reconcile } = require('../routes/paymentRoutes');
const { guardStatus, guardDelete } = require('../utils/applicationPaymentGuards');
let server,url;
before(async () => {
    process.env.JWT_SECRET='unit-test-secret';process.env.RAZORPAY_KEY_ID='rzp_test_example';process.env.RAZORPAY_KEY_SECRET='unit-gateway-secret';process.env.RAZORPAY_WEBHOOK_SECRET='unit-webhook-secret';
    const app=express();app.post('/webhook',express.raw({ type:'application/json' }),webhook);app.use(express.json());app.use('/api/payments',router);app.use('/api/service-applications',require('../routes/serviceApplicationRoutes'));
    app.use('/api/admin',require('../routes/adminRoutes'));
    app.use('/api/services',require('../routes/serviceRoutes'));
    server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));url=`http://127.0.0.1:${server.address().port}`;
});
after(()=>new Promise(resolve=>server.close(resolve)));
beforeEach(()=>{
    records=[];requests=[];paidItems=[];gateway.request=originalGatewayRequest;
    service={_id:'f'.repeat(24),name:'Real Service',status:'active',fees:'₹250'};submitted=null;
    application={ _id:ids.app, userId:ids.citizen, applicationId:'APP-1', serviceName:'Water', citizenName:'Test Citizen', status:'Approved',feePaise:25000 };
    users[ids.citizen].isActive=true;process.env.RAZORPAY_KEY_ID='rzp_test_example';
});
async function call(path,body,user=ids.citizen,method='POST') {
    const headers={'Content-Type':'application/json'};
    if (user) headers.Authorization=`Bearer ${jwt.sign({ userId:user },process.env.JWT_SECRET)}`;
    const response=await fetch(url+path,{method,headers,...(body?{body:JSON.stringify(body)}:{})});
    return { status:response.status,body:await response.json() };
}
function existing(status='Created') { const record={ _id:ids.payment,applicationId:ids.app,userId:ids.citizen,amountPaise:25000,orderId:'order_test1',status,receipt:'test-receipt',refundedPaise:0 };records.push(record);return record; }
function captured(patch={}) { return { id:'pay_test1',order_id:'order_test1',amount:25000,currency:'INR',status:'captured',created_at:1700000000,...patch }; }
test('anonymous admin requests are rejected before touching data',async()=>{assert.equal((await call('/api/admin/users',null,null,'GET')).status,401);});
test('citizen cannot access admin data or service mutations',async()=>{assert.equal((await call('/api/admin/users',null,ids.citizen,'GET')).status,403);assert.equal((await call('/api/services',{},ids.citizen)).status,403);});
test('inactive citizen cannot create a payment',async()=>{users[ids.citizen].isActive=false;assert.equal((await call('/api/payments/orders',{applicationId:ids.app})).status,403);});
test('order lookup is owned by the signed-in citizen',async()=>{assert.equal((await call('/api/payments/orders',{applicationId:ids.app},ids.other)).status,404);assert.equal(String(appQuery.userId),ids.other);assert.equal(requests.length,0);});
test('order amount comes from the saved application, never the request',async()=>{const response=await call('/api/payments/orders',{applicationId:ids.app,amount:1});assert.equal(response.status,200);assert.equal(requests[0].body.amount,25000);assert.equal(records[0].status,'Created');});
test('unapproved, free or unassessed applications cannot create an order',async()=>{for(const patch of [{status:'Pending'},{status:'Rejected'},{feePaise:0},{feePaise:null}]){const saved={...application};Object.assign(application,patch);assert.equal((await call('/api/payments/orders',{applicationId:ids.app})).status,400);Object.assign(application,saved);}assert.equal(requests.length,0);});
test('repeat requests reuse the stored provider order',async()=>{existing();const response=await call('/api/payments/orders',{applicationId:ids.app});assert.equal(response.status,200);assert.equal(response.body.order.id,'order_test1');assert(!requests.some(x=>x.path==='orders'));});
test('an in-flight or ambiguous order cannot create another order',async()=>{for(const status of ['Creating','Needs Review']){records=[];const row=existing(status);delete row.orderId;assert.equal((await call('/api/payments/orders',{applicationId:ids.app})).status,409);}assert.equal(requests.length,0);});
test('ambiguous provider errors require reconciliation rather than retry',async()=>{gateway.request=async()=>{throw new Error('network timeout')};assert.equal((await call('/api/payments/orders',{applicationId:ids.app})).status,400);assert.equal(records[0].status,'Needs Review');});
test('failed order attempts retain and reuse their order',async()=>{existing('Failed');const response=await call('/api/payments/orders',{applicationId:ids.app});assert.equal(response.status,200);assert(!requests.some(x=>x.path==='orders'));});
test('forged payment signature cannot mark paid',async()=>{existing();const response=await call('/api/payments/verify',{razorpay_order_id:'order_test1',razorpay_payment_id:'pay_test1',razorpay_signature:'f'.repeat(64)});assert.equal(response.status,400);assert.equal(records[0].status,'Created');assert.equal(requests.length,0);});
test('another citizen cannot verify or refresh this payment',async()=>{existing();assert.equal((await call('/api/payments/verify',{razorpay_order_id:'order_test1',razorpay_payment_id:'pay_test1'},ids.other)).status,404);assert.equal((await call(`/api/payments/${ids.payment}/refresh`,{},ids.other)).status,404);});
test('only captured matching amounts can be verified; duplicate verification is safe',async()=>{existing();const signature=crypto.createHmac('sha256',process.env.RAZORPAY_KEY_SECRET).update('order_test1|pay_test1').digest('hex');const body={razorpay_order_id:'order_test1',razorpay_payment_id:'pay_test1',razorpay_signature:signature};for(const patch of [{status:'authorized'},{amount:1},{currency:'USD'},{order_id:'order_wrong'}]){paidItems=[captured(patch)];assert.equal((await call('/api/payments/verify',body)).status,409);assert.equal(records[0].status,'Created');}paidItems=[captured()];assert.equal((await call('/api/payments/verify',body)).status,200);const date=records[0].paidAt;assert.equal((await call('/api/payments/verify',body)).status,200);assert.equal(records[0].paidAt,date);assert.equal(records.length,1);});
test('late failures never regress paid status',async()=>{const record=existing('Paid');paidItems=[captured({status:'failed'})];await reconcile(record);assert.equal(record.status,'Paid');});
test('fee assessment is admin-only and immutable after save',async()=>{application.feePaise=null;assert.equal((await call(`/api/payments/applications/${ids.app}/fee`,{amount:'200'},ids.citizen,'PATCH')).status,403);assert.equal((await call(`/api/payments/applications/${ids.app}/fee`,{amount:'200'},ids.admin,'PATCH')).status,200);assert.equal(application.feePaise,20000);assert.equal((await call(`/api/payments/applications/${ids.app}/fee`,{amount:'1'},ids.admin,'PATCH')).status,409);});
test('webhook rejects invalid signature and reconciles valid raw body',async()=>{existing();paidItems=[captured()];const raw=JSON.stringify({event:'payment.captured',payload:{payment:{entity:{order_id:'order_test1'}}}});const signature=crypto.createHmac('sha256',process.env.RAZORPAY_WEBHOOK_SECRET).update(raw).digest('hex');const send=signature=>fetch(url+'/webhook',{method:'POST',headers:{'Content-Type':'application/json','x-razorpay-signature':signature},body:raw});assert.equal((await send('invalid')).status,400);assert.equal(records[0].status,'Created');assert.equal((await send(signature)).status,200);assert.equal(records[0].status,'Paid');assert.equal((await send(signature)).status,200);assert.equal(records.length,1);});
test('completion and deletion retain financial integrity',async()=>{await assert.rejects(guardStatus(application,'Completed'));application.feePaise=0;await guardStatus(application,'Completed');application.feePaise=25000;const record=existing('Paid');await guardStatus(application,'Completed');await assert.rejects(guardDelete(ids.app));record.refundedPaise=25000;await assert.rejects(guardStatus(application,'Completed'));});
test('live keys are rejected by the demo integration',async()=>{process.env.RAZORPAY_KEY_ID='rzp_live_example';assert.equal((await call('/api/payments/orders',{applicationId:ids.app})).status,503);assert.equal(requests.length,0);});

test('application creation snapshots trusted service fee and keeps submitted details',async()=>{const response=await call('/api/service-applications',{serviceId:'f'.repeat(24),serviceName:'Forged title',feePaise:1,purpose:'Connection',additionalDetails:'Ground floor'});assert.equal(response.status,201);assert.equal(submitted.serviceName,'Real Service');assert.equal(submitted.feePaise,25000);assert.equal(submitted.serviceId,service._id);assert.equal(submitted.applicationData.purpose,'Connection');assert.equal(submitted.applicationData.additionalDetails,'Ground floor');});
test('descriptive service fee stays unassessed and inactive services cannot be submitted',async()=>{service.fees='As applicable';assert.equal((await call('/api/service-applications',{serviceId:'f'.repeat(24),serviceName:'Service'})).status,201);assert.equal(submitted.feePaise,null);service.status='inactive';assert.equal((await call('/api/service-applications',{serviceId:'f'.repeat(24),serviceName:'Service'})).status,400);});
test('provider refunds are reconciled monotonically and prevent service completion',async()=>{const record=existing('Paid');paidItems=[captured({status:'refunded',amount_refunded:25000})];await reconcile(record);assert.equal(record.refundedPaise,25000);paidItems=[captured({amount_refunded:0})];await reconcile(record);assert.equal(record.refundedPaise,25000);await assert.rejects(guardStatus(application,'Completed'));});
