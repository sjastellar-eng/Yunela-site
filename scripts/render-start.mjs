// Render staging only: fail closed, never infer a commercial production mode.
if (process.env.RENDER !== 'true') throw new Error('This entrypoint requires Render');
if (process.env.YUNELA_STAGE_MODE !== '1') throw new Error('Staging gate must be enabled');
if (process.env.YUNELA_SYNTHETIC_ONLY !== '1') throw new Error('Synthetic-only policy must be enabled');
if (process.env.YUNELA_LEGACY_FIXED_SKU_TESTS === '1') throw new Error('Legacy fixture must remain disabled');
if (process.env.YUNELA_DB_FILE !== '/var/data/yunela.sqlite') throw new Error('Use the persistent disk at /var/data');
process.env.YUNELA_PUBLIC_ORIGIN ||= process.env.RENDER_EXTERNAL_URL;
if (!process.env.YUNELA_PUBLIC_ORIGIN?.startsWith('https://')) throw new Error('HTTPS origin required');
process.env.NODE_ENV = 'staging';
await import('../dist-server/f3-runtime.js');
