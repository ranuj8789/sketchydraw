import { measureWrappedTextBox } from '../../canvas/textMetrics';
import { renderCanvas } from '../../canvas/canvasRender';
import { drawExportBranding } from '../../utils/exportBoard';
import { preloadDrawingImages2D } from '../../utils/drawing2d';
import { getSocialMediaPreset } from '../../utils/socialMediaPresets';

const uid = () => `creator-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
export const DEFAULT_BRAND = { name: 'Engineering Depth', font: 'Arial', accent: '#38bdf8', background: '#0b1220', foreground: '#f8fafc', logo: '' };
export function wrapPosterText(text, width, fontSize, fontFamily) {
    const measured = measureWrappedTextBox(text, { fontSize, lineHeight: Math.round(fontSize * 1.25), fontFamily, bold: true }, width);
    return { text: measured.lines.join('\n'), h: measured.h, lineHeight: measured.lineHeight };
}
export function createPoster({ preset='portrait', template='lesson', title='', body='', cta='', brand=DEFAULT_BRAND }) {
    const size = getSocialMediaPreset(preset) || getSocialMediaPreset('portrait');
    const {width:w,height:h}=size, left=size.safe.left, right=size.safe.right, top=size.safe.top;
    const contentWidth=w-left-right, elements=[];
    function text(value,y,fontSize,color=brand.foreground) {
        const wrapped=wrapPosterText(value,contentWidth,fontSize,brand.font);
        const e={id:uid(),type:'text',x:left,y,w:contentWidth,h:wrapped.h,text:wrapped.text,fontSize,fontFamily:brand.font,lineHeight:wrapped.lineHeight,stroke:color,fill:'transparent',opacity:1,bold:true};elements.push(e);return e.h;
    }
    let y=top;
    if(brand.logo) {elements.push({id:uid(),type:'image',x:left,y,w:80,h:80,src:brand.logo,opacity:1});y+=100;}
    y+=text(brand.name.toUpperCase(),y,24,brand.accent)+38;
    y+=text(title || (template==='quote'?'MAKE COMPLEX IDEAS SIMPLE.':template==='promo'?'LEARN SYSTEM DESIGN':'AI STARTS WITH NUMBERS.'),y,template==='quote'?60:64)+44;
    const lines=(body || (template==='lesson'?'Tokenize: split text into tokens.\nEmbed: represent tokens as vectors.\nContext: attention relates tokens.':template==='promo'?'Build your engineering depth.\nUnderstand systems, one diagram at a time.':'Learn by explaining.\nMake your thinking visible.')).split('\n').filter(Boolean);
    const ctaY=h-size.safe.bottom-72;
    for(const line of lines) {
        if (template === 'quote') { y+=text(line,y,32)+24; continue; }
        const box=wrapPosterText(line,contentWidth-48,32,brand.font),cardHeight=Math.max(110,box.h+48);
        elements.push({id:uid(),type:'rect',x:left,y,w:contentWidth,h:cardHeight,fill:template==='lesson'?'#172a46':'#17343c',stroke:brand.accent,strokeWidth:1,opacity:1,cornerRadius:18});
        elements.push({id:uid(),type:'text',x:left+24,y:y+24,w:contentWidth-48,h:box.h,text:box.text,fontSize:32,fontFamily:brand.font,lineHeight:box.lineHeight,stroke:brand.foreground,fill:'transparent',opacity:1,bold:true});
        y+=cardHeight+22;
    }
    if(y>ctaY-35) throw new Error('Content exceeds the safe area. Shorten the text or choose a taller format.');
    text(cta || 'SAVE THIS · EngineeringDepth.com',ctaY,24,brand.accent);
    return {canvas:{width:w,height:h},canvasProps:{backgroundColor:brand.background,pattern:'blank'},frames:[{id:uid(),name:title||'Poster',durationMs:4000,gapAfterMs:0,elements,hiddenElementIds:[],transition:'none'}]};
}
export function preserveLocked(previous, next) {
    const locked=new Map(previous.filter(e=>e.creatorLocked).map(e=>[e.id,e]));
    const result=next.map(e=>locked.get(e.id)||e);
    for(const [id,e] of locked) if(!result.some(item=>item.id===id)) result.push(e);
    return result;
}
export function downloadBlob(blob,name) {const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
// Store-mode ZIP: no network dependency, deterministic CRC and UTF-8 names.
export function zipFiles(files) {
    const enc=new TextEncoder(),chunks=[],central=[];let offset=0,centralSize=0;
    const crc=bytes=>{let n=0xffffffff;for(const b of bytes){n^=b;for(let j=0;j<8;j++)n=(n>>>1)^((n&1)?0xedb88320:0);}return (n^0xffffffff)>>>0;};
    for(const file of files){const name=enc.encode(file.name),bytes=file.bytes,checksum=crc(bytes),head=new Uint8Array(30+name.length),v=new DataView(head.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,checksum,true);v.setUint32(18,bytes.length,true);v.setUint32(22,bytes.length,true);v.setUint16(26,name.length,true);head.set(name,30);chunks.push(head,bytes);
        const c=new Uint8Array(46+name.length),cv=new DataView(c.buffer);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x800,true);cv.setUint32(16,checksum,true);cv.setUint32(20,bytes.length,true);cv.setUint32(24,bytes.length,true);cv.setUint16(28,name.length,true);cv.setUint32(42,offset,true);c.set(name,46);central.push(c);centralSize+=c.length;offset+=head.length+bytes.length;
    }
    const end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,files.length,true);v.setUint16(10,files.length,true);v.setUint32(12,centralSize,true);v.setUint32(16,offset,true);return new Blob([...chunks,...central,end],{type:'application/zip'});
}
export async function exportCarousel(frames,canvasProps,sourceSize,preset,onProgress) {
    const size=getSocialMediaPreset(preset)||getSocialMediaPreset('portrait'),files=[];
    if(!frames.length)throw new Error('No frames to export.');
    if(frames.length>100)throw new Error('Export up to 100 slides at a time.');
    for(let i=0;i<frames.length;i++){
        const frame=frames[i],hidden=new Set(frame.hiddenElementIds||[]),elements=(frame.elements||[]).filter(e=>!hidden.has(e.id)&&!e.isDeleted);
        await preloadDrawingImages2D(elements);
        const fonts=elements.filter(e=>e.type==='text');if(document.fonts)await Promise.all(fonts.map(e=>document.fonts.load(`${e.fontSize||24}px ${e.fontFamily||'Arial'}`)));
        const canvas=document.createElement('canvas'),scale=Math.min(size.width/sourceSize.width,size.height/sourceSize.height);
        renderCanvas({canvas,canvasSize:size,elements,selectedIds:[],viewport:{zoom:scale,offsetX:(size.width-sourceSize.width*scale)/2,offsetY:(size.height-sourceSize.height*scale)/2},showGrid:false,canvasProps,renderOptions:{exportMode:true,pixelRatio:1,animationTimeMs:Math.max(0,Number(frame.durationMs)||4000)}});
        const out=document.createElement('canvas');out.width=size.width;out.height=size.height;const ctx=out.getContext('2d');ctx.drawImage(canvas,0,0,out.width,out.height);drawExportBranding(ctx,out);
        const blob=await new Promise((resolve,reject)=>out.toBlob(b=>b?resolve(b):reject(new Error('Could not create PNG.')),'image/png'));
        files.push({name:`slide-${String(i+1).padStart(2,'0')}.png`,bytes:new Uint8Array(await blob.arrayBuffer())});onProgress?.(i+1,frames.length);
    }
    return zipFiles(files);
}
