import Database from 'better-sqlite3';
import {existsSync,mkdirSync,chmodSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
const source=process.env.YUNELA_DB_FILE;
const target=process.argv[2];
if(!source||!target||!existsSync(source))throw new Error('Set YUNELA_DB_FILE and provide a new backup path');
if(resolve(source)===resolve(target)||existsSync(target))throw new Error('Backup destination must be new and distinct');
mkdirSync(dirname(target),{recursive:true,mode:0o700});
const db=new Database(source,{readonly:true,fileMustExist:true});
try{await db.backup(target);chmodSync(target,0o600);const backup=new Database(target,{readonly:true,fileMustExist:true});try{if(backup.pragma('integrity_check',{simple:true})!=='ok')throw new Error('Backup integrity failed');}finally{backup.close();}console.log('SQLite online backup integrity: ok');}finally{db.close();}
