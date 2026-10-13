// A screw-mounted turn button blocks the drawer front; the printed washer sets its stand-off.
export function drawerLatch(width,height){
  const x=width-16,z=height-.2;
  const axis=(y,source)=>`translate([${x},${y},${z}]) rotate([-90,0,0]) { ${source} }`;
  return {x,z,
    boss:axis(-2.6,'cylinder(r=5,h=6.6,$fn=40);'),
    bores:axis(-2.7,'cylinder(d=3.4,h=6.8,$fn=32);')+axis(1.5,`cylinder(d=${5.7/Math.cos(Math.PI/6)},h=2.6,$fn=6);`),
    arm:'difference(){ hull(){ translate([4,4,0]) cylinder(r=4,h=3,$fn=32); translate([4,18,0]) cylinder(r=4,h=3,$fn=32); } translate([4,4,-.01]) cylinder(d=3.4,h=3.02,$fn=32); }',
    washer:'difference(){ translate([4,4,0]) cylinder(r=4,h=1,$fn=32); translate([4,4,-.01]) cylinder(d=3.4,h=1.02,$fn=32); }',
    assembledArm:p=>[x+p[0]-4,-6.6+p[2],z-(p[1]-4)],
    assembledWasher:p=>[x+p[0]-4,-3.6+p[2],z-(p[1]-4)]
  };
}
