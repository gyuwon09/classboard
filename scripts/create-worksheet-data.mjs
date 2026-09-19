import {writeFileSync,mkdirSync} from 'node:fs';
import {BUILTIN_PAGES} from '../lib/lesson.ts';
mkdirSync('tmp',{recursive:true});
writeFileSync('tmp/worksheet.json',JSON.stringify(BUILTIN_PAGES),'utf8');
