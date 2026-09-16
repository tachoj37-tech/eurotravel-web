// Empaqueta la carpeta del widget en un zip con rutas «/» (sin dependencias).
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
const [dir, salida, ...excluir] = process.argv.slice(2);
function crc32(buf){let c,crc=0xffffffff;for(let n=0;n<buf.length;n++){c=(crc^buf[n])&0xff;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;crc=(crc>>>8)^c;}return (crc^0xffffffff)>>>0;}
const files=[]; (function walk(d,p){ for(const n of fs.readdirSync(d)){ const f=path.join(d,n); const rel=p?p+'/'+n:n; if(excluir.includes(rel)) continue; if(fs.statSync(f).isDirectory()) walk(f,rel); else files.push([rel,fs.readFileSync(f)]); } })(dir,'');
const partes=[], central=[]; let off=0;
for(const [nombre,data] of files){ const comp=zlib.deflateRawSync(data); const n=Buffer.from(nombre,'utf8'); const crc=crc32(data);
 const lh=Buffer.alloc(30); lh.writeUInt32LE(0x04034b50,0); lh.writeUInt16LE(20,4); lh.writeUInt16LE(0x0800,6); lh.writeUInt16LE(8,8); lh.writeUInt16LE(0,10); lh.writeUInt16LE(0x21,12); lh.writeUInt32LE(crc,14); lh.writeUInt32LE(comp.length,18); lh.writeUInt32LE(data.length,22); lh.writeUInt16LE(n.length,26); lh.writeUInt16LE(0,28);
 const ch=Buffer.alloc(46); ch.writeUInt32LE(0x02014b50,0); ch.writeUInt16LE(20,4); ch.writeUInt16LE(20,6); ch.writeUInt16LE(0x0800,8); ch.writeUInt16LE(8,10); ch.writeUInt16LE(0,12); ch.writeUInt16LE(0x21,14); ch.writeUInt32LE(crc,16); ch.writeUInt32LE(comp.length,20); ch.writeUInt32LE(data.length,24); ch.writeUInt16LE(n.length,28); ch.writeUInt16LE(0,30); ch.writeUInt16LE(0,32); ch.writeUInt16LE(0,34); ch.writeUInt16LE(0,36); ch.writeUInt32LE(0,38); ch.writeUInt32LE(off,42);
 partes.push(lh,n,comp); central.push(ch,n); off+=lh.length+n.length+comp.length; }
const cd=Buffer.concat(central); const end=Buffer.alloc(22); end.writeUInt32LE(0x06054b50,0); end.writeUInt16LE(0,4); end.writeUInt16LE(0,6); end.writeUInt16LE(files.length,8); end.writeUInt16LE(files.length,10); end.writeUInt32LE(cd.length,12); end.writeUInt32LE(off,16); end.writeUInt16LE(0,20);
fs.writeFileSync(salida, Buffer.concat([...partes, cd, end])); console.log(files.map(f=>f[0]).join(', '));
