/** Fail before opening SQLite if a Render server was configured without its disk/gates. */
export function validateRenderStaging(env,mountInfo) {
  if(env.RENDER!=='true')throw new Error('This entrypoint requires Render');
  for(const key of ['YUNELA_STAGE_MODE','YUNELA_SYNTHETIC_ONLY','YUNELA_TEST_FIXTURES','YUNELA_WEIGHT_FIXTURES']) {
    if(env[key]!=='1')throw new Error(key+' must be enabled');
  }
  if(env.YUNELA_LEGACY_FIXED_SKU_TESTS==='1')throw new Error('Legacy fixture must remain disabled');
  if(env.VITE_STATIC_DEMO!=='0')throw new Error('Build and run the server frontend with VITE_STATIC_DEMO=0');
  if(env.HOST!=='0.0.0.0')throw new Error('Render must listen on 0.0.0.0');
  if(env.YUNELA_DB_FILE!=='/var/data/yunela.sqlite')throw new Error('Use the persistent disk at /var/data');
  const secrets=['YUNELA_AUTH_SECRET','YUNELA_STAGE_PASSWORD','YUNELA_OPERATOR_PASSWORD'].map(key=>env[key]);
  if(secrets.some((v,i)=>typeof v!=='string'||v.length<(i===0?32:16)||v.startsWith('REPLACE_')))throw new Error('Strong independent staging secrets are required');
  if(new Set(secrets).size!==secrets.length)throw new Error('Use independent auth, staging and operator secrets');
  if(!env.YUNELA_OPERATOR_EMAIL?.endsWith('@example.test'))throw new Error('Use a synthetic operator@example.test identity');
  const origin=env.YUNELA_PUBLIC_ORIGIN||env.RENDER_EXTERNAL_URL;
  let url;
  try { url=new URL(origin); } catch { throw new Error('Valid HTTPS origin required'); }
  if(url.protocol!=='https:'||url.origin!==origin)throw new Error('HTTPS origin without a path required');
  const mounted=mountInfo.split('\n').some(line=>{
    const point=line.split(' ')[4]?.replace(/\\([0-7]{3})/g,(_,octal)=>String.fromCharCode(parseInt(octal,8)));
    return point==='/var/data';
  });
  if(!mounted)throw new Error('Persistent disk mount /var/data is absent; refusing an ephemeral database');
  return {origin,databaseFile:env.YUNELA_DB_FILE,mountPath:'/var/data',mode:'offline-test'};
}
