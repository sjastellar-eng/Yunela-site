// Render staging only. Validate the actual mount before opening/migrating SQLite.
import {readFileSync} from 'node:fs';
import {validateRenderStaging} from './render-staging-preflight.mjs';
const checked=validateRenderStaging(process.env,readFileSync('/proc/self/mountinfo','utf8'));
process.env.YUNELA_PUBLIC_ORIGIN=checked.origin;
process.env.NODE_ENV = 'staging';
process.umask(0o077);
console.log('Render staging preflight: offline-test gates and /var/data mount verified');
await import('../dist-server/f3-runtime.js');
