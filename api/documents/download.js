import { db, storage } from 'hatchable';
export const access='user';
export const methods=['GET'];
export default async function(req,res) {
 const uid=String(req.user.id), id=Number(req.query?.id);
 if(!Number.isSafeInteger(id)||id<1)return res.status(400).json({error:'A valid document id is required.'});
 const q=await db.query('SELECT storage_key,original_filename,content_type FROM candidate_documents WHERE id=$1 AND user_id=$2',[id,uid]);
 if(!q.rows.length)return res.status(404).json({error:'Document not found.'});
 try {
  const url=await storage.url(q.rows[0].storage_key,{ttl:30});
  res.setHeader('Cache-Control','no-store');
  return res.redirect(302,url);
 } catch(e) {
  console.error('candidate document download URL failed');
  return res.status(500).json({error:'Could not access the document. Please retry.'});
 }
}