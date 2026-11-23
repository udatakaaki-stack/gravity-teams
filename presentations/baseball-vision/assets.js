const sharp = require('sharp');
async function png(svg, file){ await sharp(Buffer.from(svg)).png().toFile(file); }
(async()=>{
await png(`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#DDF3E4"/><stop offset="0.55" stop-color="#D9EEFF"/><stop offset="1" stop-color="#FFF3CC"/></linearGradient></defs><rect width="1920" height="1080" fill="url(#g)"/></svg>`,'bg_dark.png');
// baseball with trajectory
let stitches='';
for(let i=0;i<9;i++){const a=-1.0+i*0.25; const cx=250+Math.cos(a)*-120, cy=250+Math.sin(a)*150;}
await png(`<svg xmlns="http://www.w3.org/2000/svg" width="1300" height="1100" viewBox="0 0 1300 1100">
<path d="M80 980 Q 600 700 1000 420" fill="none" stroke="#1C6FB8" stroke-width="14" stroke-dasharray="4 34" stroke-linecap="round" opacity="0.7"/>
<g transform="translate(1000,380)">
<circle r="250" fill="#FFFEFB" stroke="#1B2A41" stroke-width="12"/>
<path d="M-150 -200 C -60 -90, -60 90, -150 200" fill="none" stroke="#C2501F" stroke-width="10"/>
<path d="M150 -200 C 60 -90, 60 90, 150 200" fill="none" stroke="#C2501F" stroke-width="10"/>
${[-150,-110,-70,-30,10,50,90,130,170].map(y=>{const t=(y+200)/400; const x=-150+ (1-Math.pow(2*t-1,2))*68; return `<line x1="${x-22}" y1="${y-14}" x2="${x+22}" y2="${y+4}" stroke="#C2501F" stroke-width="7" stroke-linecap="round"/><line x1="${-x-22}" y1="${y+4}" x2="${-x+22}" y2="${y-14}" stroke="#C2501F" stroke-width="7" stroke-linecap="round"/>`}).join('')}
</g></svg>`,'ball.png');
// DVA concept
await png(`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="760" viewBox="0 0 960 380"><rect x="0" y="0" width="192" height="340" fill="#3E8E5E" fill-opacity="0.14"/><rect x="192" y="0" width="192" height="340" fill="#2B7598" fill-opacity="0.10"/><rect x="384" y="0" width="192" height="340" fill="#E9A93B" fill-opacity="0.22"/><line x1="0" y1="340" x2="960" y2="340" stroke="#46554C" stroke-width="3"/><path d="M0 320 C 80 260, 140 170, 192 140 S 330 80, 384 66 S 500 50, 576 52 S 800 70, 960 92" fill="none" stroke="#13241B" stroke-width="8" stroke-linecap="round"/></svg>`,'dva.png');
})();
