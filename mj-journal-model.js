/* Scoped reversible patches, never a replacement of an old global save. */
(function(root){'use strict';
 const copy=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
 const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 function diff(a,b,path=[],skip=()=>false){let out=[];for(const k of new Set([...Object.keys(a||{}),...Object.keys(b||{})])){const p=[...path,k];if(skip(p))continue;const av=a?.[k],bv=b?.[k];if(equal(av,bv))continue;if(av&&bv&&typeof av==='object'&&typeof bv==='object'&&!Array.isArray(av)&&!Array.isArray(bv))out.push(...diff(av,bv,p,skip));else out.push({path:p,before:copy(av),after:copy(bv),beforeExists:av!==undefined,afterExists:bv!==undefined})}return out}
 const get=(s,path)=>path.reduce((x,k)=>x?.[k],s);
 function set(s,path,value,exists=true){let p=s;for(const k of path.slice(0,-1)){if(!p[k]||typeof p[k]!=='object')p[k]={};p=p[k]}if(exists)p[path.at(-1)]=copy(value);else delete p[path.at(-1)]}
 function canRestore(s,patches){return patches.every(p=>equal(get(s,p.path),p.after))}
 function restore(s,patches){if(!canRestore(s,patches))return false;for(const p of [...patches].reverse())set(s,p.path,p.before,p.beforeExists);return true}
 function merge(a,b){const map=new Map(),prefix=(parent,child)=>parent.length<child.length&&parent.every((k,i)=>k===child[i]);for(const incoming of [...a,...b]){const p=copy(incoming),key=JSON.stringify(p.path),exact=map.get(key);if(exact){exact.after=copy(p.after);exact.afterExists=p.afterExists;continue}const ancestor=[...map.values()].find(old=>prefix(old.path,p.path));if(ancestor){if(!ancestor.after||typeof ancestor.after!=='object')ancestor.after={};set(ancestor.after,p.path.slice(ancestor.path.length),p.after,p.afterExists);continue}const children=[...map.entries()].filter(([,old])=>prefix(p.path,old.path));if(children.length){if(!p.before||typeof p.before!=='object')p.before={};for(const [childKey,old]of children){set(p.before,old.path.slice(p.path.length),old.before,old.beforeExists);map.delete(childKey)}}map.set(key,p)}return [...map.values()].filter(p=>!equal(p.before,p.after))}

 root.MJJournalModel={copy,equal,diff,get,set,canRestore,restore,merge};
})(globalThis);
