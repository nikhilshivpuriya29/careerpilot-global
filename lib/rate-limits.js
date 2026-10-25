const ACTIONS = new Set(['inspect-form','map-fields','prepare-application','review-application','submit-application','upload-document','job-discovery','linkedin-manual-intake','integration-readiness-check','linkedin-guest-search','linkedin-guest-detail']);
export function isSupportedRateLimitAction(action) { return ACTIONS.has(action); }
export function rateLimitDecision(count, limit) {
 const safeCount=Number.isFinite(Number(count))?Math.max(0,Math.floor(Number(count))):0;
 const safeLimit=Number.isFinite(Number(limit))?Math.max(1,Math.floor(Number(limit))):1;
 return {allowed:safeCount<=safeLimit,limit:safeLimit,count:safeCount,remaining:Math.max(0,safeLimit-safeCount)};
}
export async function enforceUserRateLimit(db,userId,action,limit) {
 if(!ACTIONS.has(action))return {allowed:false,limit:1,count:1,remaining:0};
 const r=await db.query("INSERT INTO user_action_limits(user_id,action,window_start,hit_count) VALUES($1,$2,date_trunc('minute',now()),1) ON CONFLICT(user_id,action,window_start) DO UPDATE SET hit_count=user_action_limits.hit_count+1 RETURNING hit_count",[String(userId),action]);
 const result=rateLimitDecision(r.rows?.[0]?.hit_count,limit);
 return {...result,retryAfterSeconds:60-new Date().getUTCSeconds()};
}
export function runRateLimitUnitTests() {
 const cases=[
  ['allows configured LinkedIn intake action',isSupportedRateLimitAction('linkedin-manual-intake')],
  ['allows readiness checks with a dedicated limit',isSupportedRateLimitAction('integration-readiness-check')],
  ['rejects unregistered rate limit action',!isSupportedRateLimitAction('not-a-real-action')],
  ['allows first request',rateLimitDecision(1,5).allowed],
  ['allows request at limit',rateLimitDecision(5,5).allowed],
  ['blocks above limit',!rateLimitDecision(6,5).allowed],
  ['never returns negative remaining',rateLimitDecision(20,5).remaining===0],
  ['normalizes invalid counts',rateLimitDecision('bad',5).count===0],
  ['normalizes invalid limits',rateLimitDecision(1,0).limit===1]
 ];
 return {passed:cases.filter(x=>x[1]).length,failed:cases.filter(x=>!x[1]).map(x=>x[0]),total:cases.length,results:cases.map(x=>({name:x[0],passed:x[1]}))};
}