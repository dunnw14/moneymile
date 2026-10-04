export function Portrait({index,name,small=false}:{index:number;name:string;small?:boolean}){
 return <div className={small?'mm-portrait small':'mm-portrait'} role="img" aria-label={`${name}, adult Asian character, generated card portrait`} style={{backgroundImage:`url(${import.meta.env.BASE_URL}images/cast-portraits-v3.png)`,backgroundSize:'400% 300%',backgroundPosition:`${index%4*100/3}% ${Math.floor(index/4)*50}%`}}/>;
}
