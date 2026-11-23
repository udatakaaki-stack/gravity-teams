const sharp = require('sharp');
const W=1200,H=1100;
const zx=520, zy=300, zw=400, zh=470;        // strike zone
const bx=zx+zw*0.66, by=zy+zh*0.36, br=82;   // ball
const rel=[150,210];                          // release point
let grid='';
for(let i=1;i<3;i++){grid+=`<line x1="${zx+zw*i/3}" y1="${zy}" x2="${zx+zw*i/3}" y2="${zy+zh}" stroke="#8FC3F0" stroke-width="3" opacity="0.45"/><line x1="${zx}" y1="${zy+zh*i/3}" x2="${zx+zw}" y2="${zy+zh*i/3}" stroke="#8FC3F0" stroke-width="3" opacity="0.45"/>`;}
// tapered streak from release to ball
const ang=Math.atan2(by-rel[1],bx-rel[0]); const nx=-Math.sin(ang), ny=Math.cos(ang);
const streak=`<polygon points="${rel[0]},${rel[1]} ${bx+nx*br*0.9},${by+ny*br*0.9} ${bx-nx*br*0.9},${by-ny*br*0.9}" fill="url(#st)"/>`;
// gaze fixations along path, last one ahead of ball (predictive saccade)
const fx=[[rel[0]+10,rel[1]-6,22],[380,300,26],[bx-170,by+20,30],[bx+12,by+150,36]];
let gaze='';
for(let i=0;i<fx.length-1;i++) gaze+=`<line x1="${fx[i][0]}" y1="${fx[i][1]}" x2="${fx[i+1][0]}" y2="${fx[i+1][1]}" stroke="#5BD39A" stroke-width="4" stroke-dasharray="1 12" stroke-linecap="round"/>`;
fx.forEach(([x,y,r])=>gaze+=`<circle cx="${x}" cy="${y}" r="${r}" fill="#5BD39A" fill-opacity="0.15" stroke="#5BD39A" stroke-width="3"/><circle cx="${x}" cy="${y}" r="5" fill="#5BD39A"/>`);
// ball seams
let st='';
for(let k=-3;k<=3;k++){const y=k*br*0.21;const x=-br*0.6+(1-Math.pow(y/(br*0.8),2))*br*0.36;
 st+=`<line x1="${x-11}" y1="${y-8}" x2="${x+9}" y2="${y+2}" stroke="#D2552A" stroke-width="4.5" stroke-linecap="round"/><line x1="${-x-9}" y1="${y+2}" x2="${-x+11}" y2="${y-8}" stroke="#D2552A" stroke-width="4.5" stroke-linecap="round"/>`;}
const seam=s=>`<path d="M${-br*0.6*s} ${-br*0.8} C ${-br*0.2*s} ${-br*0.36}, ${-br*0.2*s} ${br*0.36}, ${-br*0.6*s} ${br*0.8}" fill="none" stroke="#D2552A" stroke-width="5"/>`;
// reticle
const R=br+30; let ticks='';
[0,90,180,270].forEach(a=>{const r=a*Math.PI/180;ticks+=`<line x1="${Math.cos(r)*(R-6)}" y1="${Math.sin(r)*(R-6)}" x2="${Math.cos(r)*(R+26)}" y2="${Math.sin(r)*(R+26)}" stroke="#FFC83D" stroke-width="6" stroke-linecap="round"/>`;});
const plate=`<path d="M${zx+50} ${zy+zh+80} H${zx+zw-50} L${zx+zw-22} ${zy+zh+118} L${zx+zw/2} ${zy+zh+160} L${zx+22} ${zy+zh+118} Z" fill="none" stroke="#8FC3F0" stroke-width="5" opacity="0.8"/>`;
const T=(x,y,s,c,t,a='start')=>`<text x="${x}" y="${y}" font-family="Arial" font-weight="700" font-size="${s}" fill="${c}" letter-spacing="4" text-anchor="${a}">${t}</text>`;
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22385A"/><stop offset="1" stop-color="#132036"/></linearGradient>
<linearGradient id="st" gradientUnits="userSpaceOnUse" x1="${rel[0]}" y1="${rel[1]}" x2="${bx}" y2="${by}"><stop offset="0" stop-color="#8FC3F0" stop-opacity="0"/><stop offset="1" stop-color="#8FC3F0" stop-opacity="0.55"/></linearGradient>
<radialGradient id="glow"><stop offset="0.55" stop-color="#FFC83D" stop-opacity="0.55"/><stop offset="1" stop-color="#FFC83D" stop-opacity="0"/></radialGradient>
</defs>
<rect x="20" y="20" width="${W-40}" height="${H-40}" rx="56" fill="url(#bg)"/>
${[0,1,2,3,4,5,6,7].map(i=>`<line x1="80" y1="${120+i*120}" x2="${W-80}" y2="${120+i*120}" stroke="#FFFFFF" stroke-width="1" opacity="0.05"/>`).join('')}
<rect x="${zx}" y="${zy}" width="${zw}" height="${zh}" rx="14" fill="#8FC3F0" fill-opacity="0.06" stroke="#8FC3F0" stroke-width="5"/>
${grid}${plate}
${streak}
${gaze}
<circle cx="${bx}" cy="${by}" r="${br+60}" fill="url(#glow)"/>
<g transform="translate(${bx},${by})"><circle r="${R}" fill="none" stroke="#FFC83D" stroke-width="4" stroke-dasharray="20 14"/>${ticks}</g>
<g transform="translate(${bx},${by}) rotate(-20)"><circle r="${br}" fill="#FFFDF6" stroke="#0E1828" stroke-width="5"/>${seam(1)}${seam(-1)}${st}</g>
${T(rel[0]-30,rel[1]-50,24,'#8FC3F0','RELEASE')}
${T(zx+zw,zy-30,44,'#FFC83D','0.46s','end')}
${T(fx[3][0]-52,fx[3][1]+8,22,'#5BD39A','GAZE','end')}
${T(80,H-80,22,'#8FC3F0','SPORTS VISION ｜ BATTING')}
</svg>`;
sharp(Buffer.from(svg)).png().toFile('cover_art.png').then(()=>console.log('ok'));
