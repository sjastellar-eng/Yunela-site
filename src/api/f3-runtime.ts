import { importCatalog,syntheticCommercial,installPolicy } from '../application/commercialCatalog';
import { DEVELOPMENT_POLICY } from '../application/flexiblePricing';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { openDatabase } from '../database/client';
import { applyMigrations } from '../database/migrate';
import { createStoreServer } from './store-server';
import { seedPartnerOffer } from '../application/partnerStore';
import candidates from '../data/supplier-candidates.json';

const secret = process.env.YUNELA_AUTH_SECRET;
if (!secret || secret.length < 32) {
  console.error('YUNELA_AUTH_SECRET must contain at least 32 characters in production');
  process.exit(1);
}

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('PORT must be an integer between 1 and 65535');
  process.exit(1);
}

const host = process.env.HOST ?? '127.0.0.1';
if (process.env.NODE_ENV === 'production') {
  console.error('This MVP is offline-test only. Production payments/dispatch are not enabled.');
  process.exit(1);
}
const databaseFile = process.env.YUNELA_DB_FILE ?? resolve('data/yunela.sqlite');
if (databaseFile === ':memory:') throw new Error('The storefront requires a persistent file database');
mkdirSync(dirname(databaseFile), { recursive: true });
process.env.YUNELA_MIGRATIONS_DIR ??= resolve('database/migrations');
const db = openDatabase(databaseFile);
applyMigrations(db);
if(!db.prepare('SELECT 1 FROM commercial_policies').get())installPolicy(db,DEVELOPMENT_POLICY);
for (const c of candidates) seedPartnerOffer(db,c);
const allowTestFixtures = process.env.YUNELA_TEST_FIXTURES === '1';
if (allowTestFixtures && process.env.YUNELA_LEGACY_FIXED_SKU_TESTS==='1') seedPartnerOffer(db,{sku:'TEST-ONLY',name:'Тестовий товар — не реальна пропозиція',test:true,price:10000,stock:10});
const staging=process.env.YUNELA_STAGE_MODE==='1';
const stagePassword=process.env.YUNELA_STAGE_PASSWORD,stageOrigin=process.env.YUNELA_PUBLIC_ORIGIN;
if(staging && (!stagePassword || stagePassword.length<16 || !stageOrigin || !process.env.YUNELA_DB_FILE || !process.env.YUNELA_OPERATOR_EMAIL || !process.env.YUNELA_OPERATOR_PASSWORD))throw new Error('Staging requires explicit persistent DB, access password (16+), origin and operator credentials');
if(staging && [secret,stagePassword,process.env.YUNELA_OPERATOR_PASSWORD].some(v=>!v||v.length<16||v.startsWith('REPLACE_')))throw new Error('Replace staging placeholders with strong independent credentials');
if(staging && stagePassword===process.env.YUNELA_OPERATOR_PASSWORD)throw new Error('Use separate staging and operator passwords');
if(staging && stageOrigin && new URL(stageOrigin).origin!==stageOrigin)throw new Error('Staging origin must have no path, query or trailing slash');
if(staging && stageOrigin && new URL(stageOrigin).protocol!=='https:' && !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(stageOrigin))throw new Error('Public staging requires HTTPS');
if(allowTestFixtures && process.env.YUNELA_WEIGHT_FIXTURES==='1' && !db.prepare('SELECT 1 FROM commercial_records WHERE source_sku=?').get(syntheticCommercial.sourceSku))importCatalog(db,[syntheticCommercial],false,'SYSTEM:synthetic');
const { server, auth } = createStoreServer({ db, secret, requireQuote:true, allowLegacyFixedSku:process.env.YUNELA_LEGACY_FIXED_SKU_TESTS==='1', staticDir:resolve('dist'),allowTestFixtures,stagingAccess:staging?{password:stagePassword!,origin:stageOrigin!,secret}:undefined });
if (process.env.YUNELA_OPERATOR_EMAIL && process.env.YUNELA_OPERATOR_PASSWORD) {
  const email = process.env.YUNELA_OPERATOR_EMAIL;
  const exists = db.prepare('SELECT 1 FROM auth_identities WHERE email=?').get(email.trim().toLowerCase());
  if (!exists) auth.provisionActor('OPERATOR',email,process.env.YUNELA_OPERATOR_PASSWORD);
}
const close = () => db.close();

const shutdown = (): void => {
  server.close(() => close());
};

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);

server.listen(port, host, () => {
  console.log(`YUNELA offline-test storefront listening on ${host}:${port}`);
});
