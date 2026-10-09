// SPDX-License-Identifier: GPL-2.0-only
import { baseplateSource } from './layout.js?v=20261009-mounts';
export function buildPart(settings, signal) {
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./vendor/openscad-worker-inlined.js',import.meta.url));
    const done=(error,result)=>{worker.terminate();signal?.removeEventListener('abort',abort);error?reject(error):resolve(result);};
    const abort=()=>done(new Error('Layout generation cancelled.'));
    if(signal?.aborted){abort();return;}signal?.addEventListener('abort',abort,{once:true});
    worker.onerror=event=>done(new Error(event.message||'Could not load the local geometry worker.'));
    worker.onmessage=({data})=>{
      const content=data.outputs?.[0]?.[1];
      if(data.error || data.exitCode!==0 || !content?.length){done(new Error((data.mergedOutputs||[]).map(l=>l.stderr||l.error||'').join('\n')||'Geometry generation failed.'));return;}
      done(null,{stl:new File([content],`${settings.part}-${settings.width}x${settings.depth}.stl`,{type:'model/stl'}),settings});
    };
    const args=['input.scad','-o','bin.stl'];
    if(settings.part==='bin')for(const [key,value] of Object.entries(settings))if(!['part'].includes(key))args.push('-D',`${key}=${JSON.stringify(value)}`);
    args.push('-D','hole_overhang_remedy=true');
    try{worker.postMessage({inputs:[['input.scad',settings.part==='baseplate'?baseplateSource(settings.cells,{magnets:settings.base_magnets,screwCells:settings.screw_cells}):'include <gridfinity_bins/gridfinity_basic_cup.scad>']],args,outputPaths:['bin.stl'],zipArchives:['gridfinity_bins']});}catch(error){done(error);}
  });
}
