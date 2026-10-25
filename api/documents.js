import { storage, db } from 'hatchable';
import crypto from 'node:crypto';
import { validateDocumentFile } from '../lib/document-upload.js';
import { enforceUserRateLimit } from '../lib/rate-limits.js';
export const access='user';
export const methods=['GET','POST','DELETE'];
export default async function(req,res) {
 const uid=String(req.user.id);
 if(req.method==='GET') {
  const q=await db.query('SELECT id,original_filename,content_type,bytes,sha256,created_at FROM candidate_documents WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30',[uid]);
  return res.json({documents:q.rows.map(d=>({...d,download_path:'/api/documents/download?id='+encodeURIComponent(String(d.id))}))});
 }
 if(req.method==='POST') {
  const limit=await enforceUserRateLimit(db,uid,'upload-document',3);if(!limit.allowed)return res.status(429).json({error:'Document upload rate limit reached. Retry in the next minute.',retry_after_seconds:limit.retryAfterSeconds});
  const file=(req.files||[]).find(f=>f.field==='file');
  const checked=validateDocumentFile(file);
  if(!checked.ok)return res.status(file&&file.buffer&&file.buffer.length>4*1024*1024?413:400).json({error:checked.error});
  const ext=checked.extension, keyUid=uid.replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,100)||'user';
  const key='candidate-documents/'+keyUid+'/'+crypto.randomUUID()+'.'+ext;
  const hash=crypto.createHash('sha256').update(file.buffer).digest('hex');
  try {
   await storage.put(key,file.buffer,checked.contentType,{metadata:{'owner-id-hash':crypto.createHash('sha256').update(uid).digest('hex').slice(0,24),'document-kind':'candidate-resume'}});
   const saved=await db.query('INSERT INTO candidate_documents(user_id,storage_key,original_filename,content_type,bytes,sha256) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,original_filename,content_type,bytes,sha256,created_at',[uid,key,checked.filename,checked.contentType,checked.bytes,hash]);
   return res.status(201).json({ok:true,document:{...saved.rows[0],download_path:'/api/documents/download?id='+encodeURIComponent(String(saved.rows[0].id))},message:'Stored privately. This original file is not yet parsed into editable resume text; paste verified text into the profile for AI tailoring.'});
  } catch(e) {
   try { await storage.del(key); } catch {}
   console.error('candidate document upload failed');
   return res.status(500).json({error:'Could not store this document securely. Please retry.'});
  }
 }
 const id=Number((req.body||{}).id);
 if(!Number.isSafeInteger(id)||id<1)return res.status(400).json({error:'A valid document id is required.'});
 const row=await db.query('SELECT id,storage_key FROM candidate_documents WHERE id=$1 AND user_id=$2',[id,uid]);
 if(!row.rows.length)return res.status(404).json({error:'Document not found.'});
 try {
  await storage.del(row.rows[0].storage_key);
  await db.query('DELETE FROM candidate_documents WHERE id=$1 AND user_id=$2',[id,uid]);
  return res.json({ok:true});
 } catch(e) {
  console.error('candidate document delete failed');
  return res.status(500).json({error:'Could not delete the document. Please retry.'});
 }
}