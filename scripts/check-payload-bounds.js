'use strict';
// Guard against the brick class that killed 3 devices (ST3 Pro, GT3 Pro, ...): a BLDC patch that
// writes bytes past the declared image length. Bytes in the 0xFF tail beyond len@0x84 are outside
// the region the controller programs + CRC-covers, so the per-frame detour jumps into unprogrammed
// flash -> FAULT/E1. Every patch byte must lie inside [0x100, 0x100+len]. A patch that writes @0x84
// (len-extend) raises the effective len, so a cave declared inside the extended length is fine.
//
// Hard-fails (exit 1) if any FLASH_ENABLED bldc build has patch bytes past its payload end. Disabled
// builds that violate it are only listed (fix len/cave before ever enabling them).
//
// Usage: node scripts/check-payload-bounds.js [patcher.js]
const fs = require('fs');
const path = process.argv[2] || require('path').join(__dirname, '..', 'patcher.js');
const src = fs.readFileSync(path, 'utf8');

const feM = src.match(/const\s+FLASH_ENABLED\s*=\s*new Set\(\[([^\]]*)\]/);
const enabled = new Set(feM ? [...feM[1].matchAll(/'([^']+)'/g)].map(m => m[1]) : []);

const heads = [...src.matchAll(/\n {2}(\w+):\s*\{/g)];
let fail = false;
const warns = [];
for (let i = 0; i < heads.length; i++) {
  const name = heads[i][1];
  const sec = src.slice(heads[i].index, i + 1 < heads.length ? heads[i + 1].index : src.length);
  if (!/kind:\s*'bldc'/.test(sec)) continue;
  const lenM = sec.match(/lenStock:\s*(0x[0-9a-fA-F]+)/);
  if (!lenM) continue;
  let eff = parseInt(lenM[1], 16);

  const pats = [...sec.matchAll(/\{\s*off:\s*(0x[0-9a-fA-F]+)\s*,\s*from:\s*\[([^\]]*)\]\s*,\s*to:\s*\[([^\]]*)\]\s*,\s*id:\s*'([^']+)'/g)]
    .map(m => ({ off: parseInt(m[1], 16), n: (m[3].match(/0x[0-9a-fA-F]+/g) || []).length, to: m[3] }));

  // a patch writing the 4-byte length field @0x84 sets the effective (post-patch) length
  const le = pats.find(p => p.off === 0x84 && p.n === 4);
  if (le) {
    const b = (le.to.match(/0x[0-9a-fA-F]+/g) || []).map(x => parseInt(x, 16));
    eff = ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0;
  }
  const payloadEnd = 0x100 + eff;
  const maxEnd = Math.max(...pats.map(p => p.off + p.n));
  const on = enabled.has(name);
  if (maxEnd > payloadEnd) {
    if (on) { console.log('FAIL ' + name + ' (ENABLED): patch reaches 0x' + maxEnd.toString(16) + ' past payload end 0x' + payloadEnd.toString(16)); fail = true; }
    else warns.push(name + ': out-of-bounds (0x' + maxEnd.toString(16) + ' > 0x' + payloadEnd.toString(16) + ')');
  } else {
    console.log('ok   ' + name + (on ? ' [enabled]' : '') + ' maxEnd 0x' + maxEnd.toString(16) + ' <= 0x' + payloadEnd.toString(16));
  }
}
if (warns.length) {
  console.log('\nDisabled bldc builds with out-of-bounds patches (extend len or move cave in-bounds before enabling):');
  warns.forEach(w => console.log('  ' + w));
}
console.log(fail ? '\nGUARD FAILED: an enabled build writes past its image length.' : '\nGUARD OK: no enabled build writes past its image length.');
process.exit(fail ? 1 : 0);
