// Keep geometry generation and STEP tessellation off the interface thread.
let occt;
self.onmessage=async({data:{id,command,params}})=>{
  const status=text=>self.postMessage({id,status:text});
  try{
    const e=await import('./engine.js');let result;
    if(command==='piece'){status('Building a closed, printable piece…');result=await e.brickMesh(params.part,params.clearance);}
    else{
      let meshes=params.meshes;
      if(command==='demo'){status('Making the lighthouse source model…');meshes=[await e.demoMesh()];}
      if(command==='step'){
        status('Loading the STEP reader…');
        if(!occt){importScripts('./vendor/occt-import-js.js');occt=await occtimportjs({locateFile:file=>new URL('vendor/'+file,self.location.href).href});}
        status('Tessellating STEP geometry…');
        const read=occt.ReadStepFile(params.bytes,{linearUnit:'millimeter',linearDeflectionType:'bounding_box_ratio',linearDeflection:.002,angularDeflection:.5});
        if(!read.success||!read.meshes?.length)throw Error('Could not read the STEP solids.');
        meshes=read.meshes.map(m=>({positions:m.attributes.position.array,indices:m.index.array}));
      }
      status('Finding whole bricks and building the parts list…');result=await e.makeSet(meshes,params.options);result.original=meshes;
    }
    self.postMessage({id,result});
  }catch(error){self.postMessage({id,error:error.message||'This model could not be built.'});}
};
