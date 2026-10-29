import {expect,it} from 'vitest';
import {validateRenderStaging} from './render-staging-preflight.mjs';
const env={RENDER:'true',HOST:'0.0.0.0',VITE_STATIC_DEMO:'0',YUNELA_STAGE_MODE:'1',YUNELA_SYNTHETIC_ONLY:'1',YUNELA_TEST_FIXTURES:'1',YUNELA_WEIGHT_FIXTURES:'1',YUNELA_DB_FILE:'/var/data/yunela.sqlite',RENDER_EXTERNAL_URL:'https://staging.example.test',YUNELA_AUTH_SECRET:'a'.repeat(32),YUNELA_STAGE_PASSWORD:'b'.repeat(24),YUNELA_OPERATOR_PASSWORD:'c'.repeat(24),YUNELA_OPERATOR_EMAIL:'operator@example.test'};
const mount='36 25 8:1 / / rw - overlay overlay rw\n40 36 8:2 / /var/data rw - ext4 /dev/disk rw\n';
it('refuses an ephemeral filesystem, including a similar mount path',()=>{
  expect(()=>validateRenderStaging(env,'36 25 8:1 / / rw - overlay overlay rw')).toThrow('mount');
  expect(()=>validateRenderStaging(env,mount.replace('/var/data ','/var/data-other '))).toThrow('mount');
  expect(validateRenderStaging(env,mount)).toMatchObject({databaseFile:'/var/data/yunela.sqlite',origin:'https://staging.example.test'});
});
it('fails closed for missing gates, fixtures, static frontend and unsafe binding',()=>{
  for(const key of ['RENDER','HOST','VITE_STATIC_DEMO','YUNELA_STAGE_MODE','YUNELA_SYNTHETIC_ONLY','YUNELA_TEST_FIXTURES','YUNELA_WEIGHT_FIXTURES','YUNELA_DB_FILE'])expect(()=>validateRenderStaging({...env,[key]:''},mount)).toThrow();
  expect(()=>validateRenderStaging({...env,YUNELA_LEGACY_FIXED_SKU_TESTS:'1'},mount)).toThrow('Legacy');
});
it('rejects invalid/reused secrets and noncanonical origin without disclosing values',()=>{
  for(const change of [{YUNELA_AUTH_SECRET:'short'},{YUNELA_OPERATOR_PASSWORD:env.YUNELA_STAGE_PASSWORD},{YUNELA_STAGE_PASSWORD:'REPLACE_WITH_PASSWORD'},{YUNELA_PUBLIC_ORIGIN:'http://staging.example.test'},{YUNELA_PUBLIC_ORIGIN:'https://staging.example.test/path'},{YUNELA_PUBLIC_ORIGIN:'not-a-url'},{YUNELA_OPERATOR_EMAIL:'real@example.com'}])expect(()=>validateRenderStaging({...env,...change},mount)).toThrow();
});
