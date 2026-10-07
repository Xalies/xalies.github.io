import {unzipSync,strFromU8} from '../shared/vendor/fflate.js';
import {asciiSTLMesh} from '../shared/mvpack.js';
import {transformPoint} from './engine.js';
const LIMIT=150000, identity=[1,0,0,0,1,0,0,0,1,0,0,0];
export function readSTL(bytes){
  if(bytes.byteLength>=84){
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),count=view.getUint32(80,true);
    if(count&&84+count*50===bytes.byteLength){
      if(count>LIMIT)throw Error('Use at most 150,000 triangles.');
      const positions=new Float32Array(count*9),indices=new Uint32Array(count*3);
      for(let f=0;f<count;f++)for(let k=0;k<9;k++){const n=view.getFloat32(84+f*50+12+k*4,true);if(!Number.isFinite(n))throw Error('Invalid STL coordinate.');positions[f*9+k]=n;}
      for(let i=0;i<indices.length;i++)indices[i]=i;return [ {positions,indices} ];
    }
  }
  const text=new TextDecoder().decode(bytes);
  if(!/^\s*solid\b/i.test(text)||! /endsolid\b/i.test(text))throw Error('This is not a complete binary or ASCII STL.');
  const mesh=asciiSTLMesh(text);if(mesh.indices.length/3>LIMIT)throw Error('Use at most 150,000 triangles.');return [mesh];
}
function xml(bytes){
  const text=strFromU8(bytes);if(/<!DOCTYPE/i.test(text))throw Error('3MF document types are not supported.');
  const doc=new DOMParser().parseFromString(text,'application/xml');if(doc.getElementsByTagName('parsererror').length)throw Error('The 3MF contains invalid XML.');return doc;
}
const children=(el,name)=>Array.from(el?.children||[]).filter(n=>n.localName===name);
function path(value,base=''){
  const parts=(value.startsWith('/')?value.slice(1):base+value).replaceAll('\\','/').split('/'),out=[];
  for(const p of parts){if(p==='..'){if(!out.length)throw Error('Invalid 3MF resource path.');out.pop();}else if(p&&p!=='.')out.push(p);}return out.join('/');
}
function matrix(text){if(!text)return identity;const m=text.trim().split(/\s+/).map(Number);if(m.length!==12||m.some(n=>!Number.isFinite(n)))throw Error('Invalid 3MF transform.');return m;}
export function read3MF(bytes){
  let expanded=0;const files=unzipSync(bytes,{filter:f=>{if(!/\.(model|rels)$/i.test(f.name))return false;expanded+=f.originalSize;if(expanded>75*1024*1024)throw Error('Expanded 3MF geometry exceeds 75 MB.');return true;}}),models=new Map(),result=[];let triangleCount=0;
  function model(name){
    if(models.has(name))return models.get(name);if(!files[name])throw Error('Missing 3MF geometry resource.');
    const doc=xml(files[name]),root=doc.documentElement;
    if(root.localName!=='model')throw Error('Invalid 3MF model.');
    const unit={micron:.001,millimeter:1,centimeter:10,inch:25.4,foot:304.8,meter:1000}[root.getAttribute('unit')||'millimeter'];if(!unit)throw Error('Unsupported 3MF units.');
    const resources=children(root,'resources')[0],objects=new Map(children(resources,'object').map(o=>[o.getAttribute('id'),o])),entry={root,objects,unit};models.set(name,entry);return entry;
  }
  let primary='3D/3dmodel.model';
  if(files['_rels/.rels']){const rel=Array.from(xml(files['_rels/.rels']).getElementsByTagNameNS('*','Relationship')).find(r=>/\/3dmodel$/.test(r.getAttribute('Type')||''));if(rel)primary=path(rel.getAttribute('Target'));}
  if(!files[primary])primary=Object.keys(files).find(n=>/\.model$/i.test(n));if(!primary)throw Error('No geometry found in the 3MF.');
  function expand(name,id,transforms,ancestors=[]){
    const key=name+'#'+id;if(ancestors.includes(key)||ancestors.length>40)throw Error('Cyclic or excessively deep 3MF components.');
    const {objects,unit}=model(name),object=objects.get(id);if(!object)throw Error('Missing 3MF object.');
    const mesh=children(object,'mesh')[0];
    if(mesh){
      const vertices=children(children(mesh,'vertices')[0],'vertex'),triangles=children(children(mesh,'triangles')[0],'triangle');triangleCount+=triangles.length;if(triangleCount>LIMIT)throw Error('Use at most 150,000 expanded triangles.');
      const positions=new Float32Array(vertices.length*3),indices=new Uint32Array(triangles.length*3);
      vertices.forEach((v,i)=>{let q=['x','y','z'].map(a=>Number(v.getAttribute(a)));if(['x','y','z'].some(a=>!v.hasAttribute(a))||q.some(n=>!Number.isFinite(n)))throw Error('Invalid 3MF vertex.');q=q.map(n=>n*unit);for(const t of transforms.slice().reverse())q=transformPoint(q,t);positions.set(q,i*3);});
      triangles.forEach((t,i)=>{const q=['v1','v2','v3'].map(a=>Number(t.getAttribute(a)));if(q.some(n=>!Number.isInteger(n)||n<0||n>=vertices.length)||['v1','v2','v3'].some(a=>!t.hasAttribute(a)))throw Error('Invalid 3MF triangle.');indices.set(q,i*3);});
      if(triangles.length)result.push({positions,indices});
    }
    for(const c of children(children(object,'components')[0],'component')){
      const external=Array.from(c.attributes).find(a=>a.localName==='path')?.value,other=external?path(external,name.slice(0,name.lastIndexOf('/')+1)):name;
      const transform=matrix(c.getAttribute('transform')).slice();transform[9]*=unit;transform[10]*=unit;transform[11]*=unit;
      expand(other,c.getAttribute('objectid'),[...transforms,transform],[...ancestors,key]);
    }
  }
  const main=model(primary),items=children(children(main.root,'build')[0],'item');if(!items.length)throw Error('The 3MF has no build items.');
  for(const item of items){const t=matrix(item.getAttribute('transform')).slice();t[9]*=main.unit;t[10]*=main.unit;t[11]*=main.unit;expand(primary,item.getAttribute('objectid'),[t]);}
  if(!result.length)throw Error('No triangle meshes found in the 3MF.');return result;
}
