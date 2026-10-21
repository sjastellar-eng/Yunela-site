export const REQUIRED_SENSORY_FIELDS=['aroma','sweetness','freshness','body','roast','depth','discoveryDistance'] as const;
/** Data-only gate. Never converts a style description to a Tea or invents commerce fields. */
export function assessSommelierReadiness(input:unknown):{eligible:boolean;reasons:string[]}{
 if(!input||typeof input!=='object')return{eligible:false,reasons:['INVALID_RECORD']};
 const r=input as Record<string,unknown>,reasons:string[]=[];
 if(typeof r.sourceSku!=='string'||! /^(PHOTO|LIST)-\d{3}$/.test(r.sourceSku))reasons.push('NOT_REAL_CATALOGUE_RECORD');
 if(r.canonicalStatus!=='CONFIRMED'||typeof r.canonicalTeaId!=='string')reasons.push('PROVISIONAL_IDENTITY');
 if(r.recommendationApproved!==true)reasons.push('NOT_APPROVED');
 const sensory=r.sensory as Record<string,unknown>|undefined,verified=r.verifiedFields;
 for(const field of REQUIRED_SENSORY_FIELDS){const v=field==='discoveryDistance'?r.discoveryDistance:sensory?.[field];
  if(!Array.isArray(verified)||!verified.includes(field))reasons.push('UNVERIFIED_'+field);
  if(field==='aroma'?(!Array.isArray(v)||!v.length||!v.every(x=>typeof x==='string')):(typeof v!=='number'||!Number.isFinite(v)||v<0||v>100))reasons.push('MISSING_OR_INVALID_'+field);
 }
 const evidence=r.facts as Record<string,{scope?:string;sourceIds?:unknown[];checkedAt?:string;approvedForRecommendation?:boolean}>|undefined;
 if(!r.lotId||REQUIRED_SENSORY_FIELDS.some(k=>{const e=evidence?.[k];return e?.scope!=='lot'||e.approvedForRecommendation!==true||!e.checkedAt||!e.sourceIds?.length;}))reasons.push('NO_VERIFIED_LOT_EVIDENCE');
 return{eligible:reasons.length===0,reasons};
}
