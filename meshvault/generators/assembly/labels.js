// Open-front rails retain the paper edges without hiding the label.
export function labelHolderSource(centre,front=0,bottom=3){
  const x=centre-20.3,y=front-2;
  return `translate([${x},${y},${bottom}]) cube([40.6,2.2,1.2]); for(x=[${x},${x+38.6}]) translate([x,${y},${bottom}]) cube([2,2.2,11.2]); for(x=[${x},${x+37.4}]) translate([x,${y},${bottom}]) cube([3.2,.6,11.2]);`;
}
