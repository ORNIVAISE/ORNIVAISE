import fs from 'node:fs';import {spawnSync} from 'node:child_process';
for(const file of fs.readdirSync('tests').filter(x=>x.endsWith('.test.mjs')).sort()){const r=spawnSync(process.execPath,['tests/'+file],{encoding:'utf8'});if(r.status){process.stderr.write(r.stderr);process.exit(r.status||1)}process.stdout.write(r.stdout)}
