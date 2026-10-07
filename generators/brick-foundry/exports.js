import {zipSync,strToU8} from '../shared/vendor/fflate.js';
import {create3MF,createSetPackage} from '../shared/mvpack.js';
import {binarySTL} from '../vessels/geometry.js';
import {cells,rotateCell,studs,placementTransform} from './engine.js';
export const plateSTL=mesh=>binarySTL(mesh,'z');
export {create3MF};
export const colours={brick:'#275bd7',plate:'#efb937',tile:'#e8e3d8',slope:'#e76640',corner:'#6e9a7e',round:'#7c68a8'};
export const label=p=>`${p.type[0].toUpperCase()+p.type.slice(1)} ${p.w} × ${p.l}`;
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const filename=s=>String(s).replace(/\.[^.]+$/,'').replace(/[^a-z0-9_-]+/gi,'-').slice(0,60)||'brick-foundry';
export function inventoryCSV(set){return 'part_id,piece,width_studs,length_studs,height_plates,quantity\n'+set.variants.map((v,i)=>[i+1,v.type,v.w,v.l,v.h,v.quantity].join(',')).join('\n')+'\n';}
export function layout(set,settings){return {generator:'Brick Foundry',version:1,unit:'millimeter',pitch:8,layerHeight:3.2,settings,dimensions:set.dimensions,connections:set.connections,parts:set.variants.map(({mesh,...v},i)=>({number:i+1,...v})),placements:set.pieces.map(p=>({part:p.part.id,x:p.x,y:p.y,z:p.z,quarterTurns:p.r}))};}
export function layerSVG(set,layer,palette={}){
  const [w,l]=set.dimensions,number=new Map(set.variants.map((v,i)=>[v.id,i+1]));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 ${w*16+2} ${l*16+2}" role="img" aria-label="Pieces starting on plate layer ${layer+1}"><rect width="${w*16}" height="${l*16}" fill="#f3f0e7"/>${set.pieces.filter(p=>p.z===layer).map(p=>{
    const colour=palette[p.part.id]||colours[p.part.type],bottom=cells(p.part).filter(q=>q[2]===0),W=p.r%2?p.part.l:p.part.w,D=p.r%2?p.part.w:p.part.l;
    const rects=bottom.map(([x,y])=>{const [u,v]=rotateCell(x,y,p.part,p.r);return `<rect x="${(p.x+u)*16+1}" y="${(p.y+v)*16+1}" width="14" height="14" fill="${colour}" stroke="#1d2742" stroke-width=".35"/>`;}).join('');
    const dots=studs(p.part).map(([x,y])=>{const [u,v]=rotateCell(x,y,p.part,p.r);return `<circle cx="${(p.x+u)*16+8}" cy="${(p.y+v)*16+8}" r="3.8" fill="none" stroke="#fff" stroke-opacity=".4"/>`;}).join('');
    return rects+dots+`<text x="${(p.x+W/2)*16}" y="${(p.y+D/2)*16+3}" text-anchor="middle" font-family="sans-serif" font-size="8" font-weight="bold" fill="#fff" stroke="#1d2742" stroke-width=".2">${number.get(p.part.id)}</text>`;
  }).join('')}</svg>`;
}
export function guideHTML(set,name,settings,palette={}){
  const layers=[...new Set(set.pieces.map(p=>p.z))].sort((a,b)=>a-b);
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(name)} · Assembly guide</title><style>body{font:16px/1.55 system-ui,sans-serif;color:#202c44;background:#f7f4ed;max-width:1100px;margin:40px auto;padding:20px}h1{font-size:40px;line-height:1.1}h2{margin-top:32px}table{border-collapse:collapse;width:100%}td,th{text-align:left;border-bottom:1px solid #d9d4c9;padding:8px}.steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px}article{background:white;padding:16px;border-radius:12px}svg{width:100%;max-height:320px}small{color:#536075}@media print{body{background:white;margin:0}article{break-inside:avoid}}</style><h1>${escape(name)}</h1><p>Brick Foundry · ${set.pieces.length} pieces · ${set.variants.length} different parts · ${set.dimensions[0]} × ${set.dimensions[1]} studs</p><p>Build from the bottom upwards. Each diagram shows the pieces <b>starting</b> at that height; part numbers match the inventory. X runs right, Y runs down. One plate layer is 3.2 mm; a brick is three layers high. Studs on the diagrams indicate connection faces.</p><p>${set.connections.groups>1?`${set.connections.groups} separate stud-connected groups were detected. Assemble separate groups before positioning them; unsupported overhangs may need a redesign or reinforcement.`:'The set has one stud-connected group.'} This is a shape approximation, not a structural or clutch-strength simulation.</p><h2>Print & fit</h2><p>Print the individual files with the open underside on the bed. Fit adjustment: ${Number(settings.clearance).toFixed(2)} mm. Positive adjustment loosens the fit by shrinking studs and internal supports. Test two pieces first; printer, filament and slicer compensation affect clutch. The assembled 3MF is a layout reference, not a single-piece print.</p><h2>Parts inventory</h2><table><thead><tr><th>Part</th><th>Shape</th><th>Colour</th><th>Print copies</th></tr></thead><tbody>${set.variants.map((v,i)=>`<tr><td>${i+1}</td><td>${label(v)}</td><td>${palette[v.id]||colours[v.type]}</td><td>${v.quantity}</td></tr>`).join('')}</tbody></table><h2>Assembly steps</h2><div class="steps">${layers.map((z,i)=>`<article><h3>${i+1}. At ${(z*3.2).toFixed(1)} mm</h3><small>Plate layer ${z+1} · ${set.pieces.filter(p=>p.z===z).length} new pieces</small>${layerSVG(set,z,palette)}</article>`).join('')}</div><p><small>Independent generator; not affiliated with or endorsed by the LEGO Group. Nominal 8 mm construction system. Generated locally by <a href="https://xalies.github.io/generators/brick-foundry/">Brick Foundry</a>.</small></p></html>`;
}
export function assembled3MF(set,palette={}){
  const ids=new Map(set.variants.map((v,i)=>[v.id,i+2]));
  const objects=set.variants.map((v,i)=>{
    const vertices=[];for(let j=0;j<v.mesh.positions.length;j+=3)vertices.push(`<vertex x="${v.mesh.positions[j]}" y="${v.mesh.positions[j+1]}" z="${v.mesh.positions[j+2]}"/>`);
    const triangles=[];for(let j=0;j<v.mesh.indices.length;j+=3)triangles.push(`<triangle v1="${v.mesh.indices[j]}" v2="${v.mesh.indices[j+1]}" v3="${v.mesh.indices[j+2]}"/>`);
    return `<object id="${i+2}" type="model" name="${label(v)}" pid="1" pindex="${i}"><mesh><vertices>${vertices.join('')}</vertices><triangles>${triangles.join('')}</triangles></mesh></object>`;
  });
  const base=zipSync({
    '[Content_Types].xml':strToU8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>'),
    '_rels/.rels':strToU8('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="r0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>'),
    '3D/3dmodel.model':strToU8(`<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><metadata name="Title">Brick Foundry assembly reference</metadata><resources><basematerials id="1">${set.variants.map(v=>`<base name="${label(v)}" displaycolor="${(palette[v.id]||colours[v.type]).toUpperCase()}FF"/>`).join('')}</basematerials>${objects.join('')}</resources><build>${set.pieces.map(p=>`<item objectid="${ids.get(p.part.id)}" transform="${placementTransform(p).join(' ')}"/>`).join('')}</build></model>`)
  },{level:1});return new Blob([base],{type:'model/3mf'});
}
export async function exportSet(set,{name,settings,thumbnail,palette={},meshvault=false}){
  const title=filename(name),guide=new Blob([guideHTML(set,name,settings,palette)],{type:'text/html'}),inventory=new Blob([inventoryCSV(set)],{type:'text/csv'}),plan=new Blob([JSON.stringify(layout(set,settings),null,2)],{type:'application/json'});
  if(!meshvault){
    const entries={'assembly-guide.html':strToU8(guideHTML(set,name,settings,palette)),'parts.csv':strToU8(inventoryCSV(set)),'layout.json':strToU8(await plan.text()),'assembled-reference.3mf':new Uint8Array(await assembled3MF(set,palette).arrayBuffer()),'preview.png':new Uint8Array(await thumbnail.arrayBuffer())};
    for(const v of set.variants){entries[`pieces/${v.id}--print-${v.quantity}.stl`]=plateSTL(v.mesh);entries[`pieces/${v.id}--print-${v.quantity}.3mf`]=new Uint8Array(await create3MF(v.mesh).arrayBuffer());}
    return new Blob([zipSync(entries,{level:1})],{type:'application/zip'});
  }
  const common={author:'Xalies',authorUrl:'https://xalies.github.io/',generatorName:'Brick Foundry',sourceUrl:'https://xalies.github.io/generators/brick-foundry/',tags:['bricks','construction','3d-printing'],thumbnail,printNotes:{orientation:'Open underside on bed',fitAdjustmentMm:settings.clearance},summary:'Whole construction pieces approximating a source model.'};
  const models=set.variants.map(v=>({...common,title:label(v),file:new File([create3MF(v.mesh)],v.id+'.3mf',{type:'model/3mf'}),settings:{...settings,part:v.id,quantity:v.quantity,colour:palette[v.id]||colours[v.type]},descriptionHtml:`<p>Print ${v.quantity} copies of this piece for ${escape(name)}.</p>`}));
  return createSetPackage(models,true,{...common,title,settings:layout(set,settings),summary:`${set.pieces.length} pieces, ${set.variants.length} variants; includes assembly guide and inventory.`,documents:[{name:'assembly-guide.html',blob:guide},{name:'parts.csv',blob:inventory},{name:'layout.json',blob:plan},{name:'assembled-reference.3mf',blob:assembled3MF(set,palette)}]});
}
