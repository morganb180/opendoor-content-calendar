const STORE_KEY="opendoor_calendar_v2";
const COMMENTS_KEY="opendoor_comments_v1";      // {postId: [{id,text,author,ts}]}
const COMMENT_AUTHOR_KEY="opendoor_comment_author";
const LAST_SYNC_KEY="opendoor_last_sync_exported_at";
const GH_TOKEN_KEY="gh_pat";
const TODAY=localDateKey(new Date());
const UPLOAD_MAX_BYTES=300*1024;
let THEME={};
let MARKERS={};
const DEFAULTS=[];
const INVENTORY=[];
const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
const MON3=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DOW=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const storage={
  get(key,fallback=""){return localStorage.getItem(key)??fallback;},
  set(key,value){localStorage.setItem(key,value);},
  remove(key){localStorage.removeItem(key);},
  getJSON(key,fallback){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback;}catch(e){return fallback;}},
  setJSON(key,value){localStorage.setItem(key,JSON.stringify(value));}
};
/* Content is loaded from data/calendar.json. */

/* ===== STATE ===== */
let posts=[];
let view="month", viewY=2026, viewM=6;
let pendingExtra=null;          // slides/file carried into Add from inventory
let pendingCanvaImports=[];
let lbItem=null, lbIdx=0, lbSlides=[];
let activity=[];
const INV_HIDDEN_KEY="opendoor_inv_hidden_v2";   // hidden inventory ids
const INV_CUSTOM_KEY="opendoor_inv_custom_v1";   // user-added inventory items
let invHidden=loadHidden(), customInv=loadCustom();
let initialData=null;
let modalMode="post";                            // "post" | "inv"
function loadHidden(){return new Set(storage.getJSON(INV_HIDDEN_KEY,[]));}
function saveHidden(){storage.setJSON(INV_HIDDEN_KEY,[...invHidden]);}
function loadCustom(){return storage.getJSON(INV_CUSTOM_KEY,[]);}
function saveCustom(){storage.setJSON(INV_CUSTOM_KEY,customInv);}
function slug(s){return (s||"item").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");}
// unified inventory comes from data/calendar.json; local custom additions are folded into v7 data on save/publish.
function allInv(){return customInv;}
// "new inventory" notification — track which item ids have been seen
const INV_SEEN_KEY="opendoor_inv_seen_v1";
let invSeen=loadSeen();
function loadSeen(){const raw=storage.getJSON(INV_SEEN_KEY,null);
  if(raw)return new Set(raw);
  const s=new Set(customInv.map(it=>it.id));  // first run: existing catalog isn't "new"
  storage.setJSON(INV_SEEN_KEY,[...s]);return s;}
function saveSeen(){storage.setJSON(INV_SEEN_KEY,[...invSeen]);}
function newInvCount(){return allInv().filter(it=>!invHidden.has(it.id)&&!invSeen.has(it.id)).length;}
function markInvSeen(){let ch=false;allInv().forEach(it=>{if(!invHidden.has(it.id)&&!invSeen.has(it.id)){invSeen.add(it.id);ch=true;}});if(ch)saveSeen();}

/* ===== COMMENTS ===== */
function loadComments(){return storage.getJSON(COMMENTS_KEY,{});}
function saveComments(){storage.setJSON(COMMENTS_KEY,comments);}
let comments=loadComments();
function getCommentAuthor(){return storage.get(COMMENT_AUTHOR_KEY);}
function setCommentAuthor(a){storage.set(COMMENT_AUTHOR_KEY,a);}
function avatarColor(name){const colors=["#1f80ff","#7c3aed","#ff7a45","#0ea5e9","#16a34a","#dc2626","#d97706","#6366f1"];let h=0;for(const c of name)h=(h*31+c.charCodeAt(0))|0;return colors[Math.abs(h)%colors.length];}
function avatarInitials(name){const p=(name||"?").trim().split(/\s+/);return ((p[0]||"?")[0]+((p[1]||"")[0]||"")).toUpperCase();}
function commentKey(id){return id||(lbItem&&lbItem.id?lbItem.id:"");}
function addComment(){
  const inp=document.getElementById("lbCommentInput");const text=inp.value.trim();if(!text)return;
  let author=getCommentAuthor();
  if(!author){author=prompt("Your name (for comments):");if(!author)return;author=author.trim();setCommentAuthor(author);}
  const key=commentKey(lbItem&&lbItem._id);if(!key)return;
  if(!comments[key])comments[key]=[];
  comments[key].push({id:"c-"+Date.now().toString(36),text,author,ts:Date.now()});
  saveComments();inp.value="";renderComments(key);
}
function deleteComment(cid){
  const key=commentKey(lbItem&&lbItem._id);if(!key||!comments[key])return;
  comments[key]=comments[key].filter(c=>c.id!==cid);saveComments();renderComments(key);
}
function fmtCommentTime(ts){const d=new Date(ts),now=new Date();const diff=now-d;const m=6e4,h=36e5,day=864e5;
  if(diff<m)return"Just now";if(diff<h)return Math.floor(diff/m)+"m ago";
  if(diff<day)return Math.floor(diff/h)+"h ago";if(diff<7*day)return Math.floor(diff/day)+"d ago";
  return d.toLocaleDateString("en-US",{month:"short",day:"numeric"});
}
function renderComments(key){
  const list=(comments[key]||[]);
  document.getElementById("lbCommentCount").textContent=list.length?"("+list.length+")":"";
  document.getElementById("lbCommentList").innerHTML=list.map(c=>
    '<div class="lb-comment"><div class="avatar" style="background:'+avatarColor(c.author)+'">'+avatarInitials(c.author)+'</div>'+
    '<div class="body"><div class="meta"><b>'+esc(c.author)+'</b> · '+fmtCommentTime(c.ts)+
    '<span class="del" data-action="delete-comment" data-comment-id="'+escAttr(c.id)+'">Delete</span></div>'+
    '<div class="text">'+esc(c.text)+'</div></div></div>'
  ).join("");
}

/* ===== SOCIAL CAPTION COPY ===== */
function showCanvaStatus(msg,ok){const el=document.getElementById("canvaStatus");if(!el)return;el.textContent=msg;el.className="canva-status"+(ok===true?" ok":ok===false?" err":"");}
function toggleCanvaPushRow(){const row=document.getElementById("canvaPushRow");const sc=document.getElementById("f-socialCaption").value.trim();row.style.display=sc?"flex":"none";if(!sc)showCanvaStatus("","");}
async function copySocialCaption(){
  const sc=document.getElementById("f-socialCaption").value.trim();
  try{await navigator.clipboard.writeText(sc);showCanvaStatus("Copied ✓",true);}
  catch(e){showCanvaStatus("Couldn't copy — select manually.",false);}
}

/* ===== CANVA IMPORT ===== */
function openCanvaImport(){
  pendingCanvaImports=[];
  document.getElementById("canvaImportStatus").textContent="";
  document.getElementById("canvaImportStatus").className="import-status";
  document.getElementById("canvaImportPreview").className="import-preview";
  document.getElementById("canvaImportPreview").innerHTML="";
  document.getElementById("canvaImportOverlay").classList.add("open");
  document.getElementById("canvaImportText").focus();
}
function closeCanvaImport(){document.getElementById("canvaImportOverlay").classList.remove("open");}
function showCanvaImportStatus(msg,ok){const el=document.getElementById("canvaImportStatus");el.textContent=msg;el.className="import-status"+(ok===true?" ok":ok===false?" err":"");}
function sampleCanvaImport(){
  document.getElementById("canvaImportText").value=[
    "https://www.canva.com/design/DAH_SAMPLE01/edit, 2026-08-03, seasonal, Back-to-school opener, Ready for a move before school starts?",
    "https://www.canva.com/design/DAH_SAMPLE02/view | brand | Home equity explainer | Sell simply, move confidently."
  ].join("\n");
  parseCanvaImports();
}
function clearCanvaImport(){
  pendingCanvaImports=[];
  document.getElementById("canvaImportText").value="";
  renderCanvaImportPreview();
  showCanvaImportStatus("","");
}
function canvaLinksFrom(text){return text.match(/https?:\/\/[^\s,"'<>]*canva\.com\/[^\s,"'<>]*/gi)||[];}
function extractCanvaId(value){
  const raw=(value||"").trim();if(!raw)return null;
  return raw.match(/[?&](?:design_id|template_id)=([^&#]+)/)?.[1]||raw.match(/\/design\/([^/?#]+)/)?.[1]||raw.match(/\/templates\/([^/?#]+)/)?.[1]||raw.match(/\bDA[A-Za-z0-9_-]{6,}\b/)?.[0]||null;
}
function splitImportRow(row){
  const delimiter=row.includes("\t")?"\t":row.includes("|")?"|":",";
  const out=[];let cur="",quoted=false;
  for(let i=0;i<row.length;i++){
    const ch=row[i],next=row[i+1];
    if(ch==='"'&&quoted&&next==='"'){cur+='"';i++;continue;}
    if(ch==='"'){quoted=!quoted;continue;}
    if(ch===delimiter&&!quoted){out.push(cur.trim());cur="";continue;}
    cur+=ch;
  }
  out.push(cur.trim());return out.filter(Boolean);
}
function normalizeDate(value){
  const s=(value||"").trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
  const m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);if(!m)return null;
  const y=Number(m[3].length===2?"20"+m[3]:m[3]);return y+"-"+String(m[1]).padStart(2,"0")+"-"+String(m[2]).padStart(2,"0");
}
function normalizeTheme(value){
  const key=(value||"").trim().toLowerCase().replace(/\s+/g,"");
  const map={seasonal:"seasonal",worldcup:"worldcup",world:"worldcup",wc:"worldcup",meme:"meme",proof:"proof",brand:"brand"};
  return map[key]||null;
}
function inferCanvaTitle(canvaId){return canvaId?"Canva design "+canvaId:"Untitled Canva import";}
function parseCanvaImportLine(line,defaults){
  const fields=splitImportRow(line);let canvaField=fields.find(x=>extractCanvaId(x));
  if(!canvaField){const links=canvaLinksFrom(line);canvaField=links[0]||line.match(/\bDA[A-Za-z0-9_-]{6,}\b/)?.[0];}
  const canvaId=extractCanvaId(canvaField);if(!canvaId)return null;
  const rest=fields.filter(x=>x!==canvaField);
  const dateIndex=rest.findIndex(x=>normalizeDate(x));
  const themeIndex=rest.findIndex(x=>normalizeTheme(x));
  const targetDate=dateIndex>=0?normalizeDate(rest[dateIndex]):"";
  const theme=themeIndex>=0?normalizeTheme(rest[themeIndex]):defaults.theme;
  const remainder=rest.filter((_,i)=>i!==dateIndex&&i!==themeIndex);
  const title=remainder[0]||inferCanvaTitle(canvaId);
  const socialCaption=remainder.slice(1).join(", ");
  const caption="Imported from Canva"+(targetDate?" · target date "+targetDate:"")+".";
  return {title,theme,fmt:defaults.fmt,caption,socialCaption,canva:canvaField||canvaId,img:"",targetDate,source:"canva-import"};
}
function parseCanvaImports(){
  const raw=document.getElementById("canvaImportText").value.trim();
  if(!raw){pendingCanvaImports=[];renderCanvaImportPreview();showCanvaImportStatus("Paste at least one Canva URL.",false);return;}
  const defaults={theme:document.getElementById("canvaImportTheme").value,fmt:document.getElementById("canvaImportFmt").value.trim()||"Static · 4:5"};
  const lines=raw.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const parsed=[];
  lines.forEach(line=>{
    const item=parseCanvaImportLine(line,defaults);
    if(item)parsed.push(item);
    else canvaLinksFrom(line).forEach(link=>{const linkItem=parseCanvaImportLine(link,defaults);if(linkItem)parsed.push(linkItem);});
  });
  const seen=new Set();pendingCanvaImports=parsed.filter(item=>{const id=extractCanvaId(item.canva);if(seen.has(id))return false;seen.add(id);return true;});
  renderCanvaImportPreview();
  showCanvaImportStatus(pendingCanvaImports.length?"Found "+pendingCanvaImports.length+" Canva item"+(pendingCanvaImports.length===1?"":"s")+".":"No Canva design links found.",!!pendingCanvaImports.length);
}
function renderCanvaImportPreview(){
  const box=document.getElementById("canvaImportPreview");
  if(!pendingCanvaImports.length){box.className="import-preview";box.innerHTML="";return;}
  const destination=document.getElementById("canvaImportDestination").value;
  box.className="import-preview open";
  box.innerHTML='<table class="import-table"><thead><tr><th>Destination</th><th>Title</th><th>Theme</th><th>Date</th><th>Canva</th><th>Social caption</th><th></th></tr></thead><tbody>'+pendingCanvaImports.map((item,i)=>{
    const dest=destination==="schedule"&&item.targetDate?"Schedule":"Inventory";
    return '<tr><td>'+dest+'</td>'+editableImportCell(i,"title",item.title,"Title")+
      '<td><select data-import-index="'+i+'" data-import-field="theme">'+Object.keys(THEME).map(k=>'<option value="'+escAttr(k)+'"'+(item.theme===k?' selected':'')+'>'+esc(THEME[k].label)+'</option>').join("")+'</select></td>'+editableImportCell(i,"targetDate",item.targetDate,"YYYY-MM-DD")+
      '<td class="muted">'+esc(extractCanvaId(item.canva)||"")+'</td>'+editableImportCell(i,"socialCaption",item.socialCaption,"Caption",true)+
      '<td><button class="mini-del" data-action="remove-canva-import" data-index="'+escAttr(String(i))+'" title="Remove row">×</button></td></tr>';
  }).join("")+'</tbody></table>';
}
function editableImportCell(i,field,value,placeholder,longText){
  const attrs='data-import-index="'+escAttr(String(i))+'" data-import-field="'+escAttr(field)+'" placeholder="'+escAttr(placeholder)+'"';
  return longText
    ? '<td><textarea rows="2" '+attrs+'>'+esc(value||"")+'</textarea></td>'
    : '<td><input '+attrs+' value="'+escAttr(value||"")+'"></td>';
}
function updateCanvaImportField(el){
  const item=pendingCanvaImports[Number(el.dataset.importIndex)];if(!item)return;
  let value=el.value.trim();
  if(el.dataset.importField==="targetDate")value=normalizeDate(value)||value;
  item[el.dataset.importField]=value;
}
function removeCanvaImport(index){pendingCanvaImports.splice(Number(index),1);renderCanvaImportPreview();showCanvaImportStatus(pendingCanvaImports.length?"Ready to import "+pendingCanvaImports.length+" item"+(pendingCanvaImports.length===1?"":"s")+".":"No rows selected.",!!pendingCanvaImports.length);}
function saveCanvaImports(){
  if(!pendingCanvaImports.length)parseCanvaImports();
  if(!pendingCanvaImports.length)return;
  const destination=document.getElementById("canvaImportDestination").value;
  let addedPosts=0,addedInv=0;
  pendingCanvaImports.forEach(item=>{
    const {targetDate,source,...base}=item;
    if(destination==="schedule"&&targetDate){posts.push(touchItem({id:uid(),status:"scheduled",date:targetDate,holiday:"",postedUrl:"",...base}));addedPosts++;}
    else{customInv.push(touchItem({id:uid(),status:"ready",...base}));addedInv++;}
  });
  save();closeCanvaImport();setView(addedPosts?"month":"inv");
  toast("Imported "+(addedPosts?addedPosts+" scheduled":"")+(addedPosts&&addedInv?" + ":"")+(addedInv?addedInv+" inventory":"")+" item"+((addedPosts+addedInv)===1?"":"s"));
}

function nowISO(){return new Date().toISOString();}
function markerType(t){return ["hol","evt","mkt"].includes(t)?t:"evt";}
function markerToApp(m){return {l:m.label,t:markerType(m.type)};}
function markerToData(m){return {label:m.label||m.l||"",type:markerType(m.type||m.t)};}
function dataToAppItem(item){const media=item.media||{};return {...item,img:media.img||item.img||"",slides:media.slides||item.slides||[],video:media.video||item.video||item.file||""};}
function appToDataItem(item,kind){const updatedAt=item.updatedAt||nowISO();const out={
  id:item.id||uid(),status:item.status||(kind==="post"?"scheduled":"ready"),title:item.title||"Untitled",theme:item.theme||Object.keys(THEME)[0]||"brand",
  fmt:item.fmt||"",caption:item.caption||"",socialCaption:item.socialCaption||"",canva:item.canva||"",
  media:{img:item.img||"",slides:item.slides||[],video:item.video||item.file||""},updatedAt
};
  if(kind==="post"){out.date=item.date||TODAY;out.holiday=item.holiday||"";out.postedUrl=item.postedUrl||"";}
  else{if(item.builtin!==undefined)out.builtin=!!item.builtin;if(item.localOnly!==undefined)out.localOnly=!!item.localOnly;}
  return out;
}
function dataToState(d){
  if(!d||d.version!==7||!Array.isArray(d.posts)||!Array.isArray(d.inventory))return false;
  THEME={};Object.entries(d.config?.themes||{}).forEach(([k,v])=>{THEME[k]={cls:"b-"+k,color:v.color,label:v.label};});
  MARKERS={};Object.entries(d.markers||{}).forEach(([date,value])=>{MARKERS[date]=Array.isArray(value)?value.map(markerToApp):markerToApp(value);});
  posts=d.posts.map(dataToAppItem);
  customInv=d.inventory.map(dataToAppItem);saveCustom();
  if(!storage.get(INV_SEEN_KEY)){invSeen=new Set(customInv.map(it=>it.id));saveSeen();}
  comments=normalizeCommentKeys(d.comments||{});saveComments();
  storage.setJSON(STORE_KEY,posts);storage.set("opendoor_calendar_updated_at",d.updatedAt||"");
  return true;
}
function stateToData(){return {version:7,updatedAt:nowISO(),config:{cadence:"Mon/Wed/Fri + event specials",timezone:"America/Los_Angeles",themes:Object.fromEntries(Object.entries(THEME).map(([k,v])=>[k,{color:v.color,label:v.label}]))},markers:Object.fromEntries(Object.entries(MARKERS).map(([date,value])=>[date,Array.isArray(value)?value.map(markerToData):markerToData(value)])),posts:posts.map(p=>appToDataItem(p,"post")),inventory:customInv.map(it=>appToDataItem(it,"inventory")),comments:normalizeCommentKeys(comments)};}
function migrateV6(d){
  const now=nowISO();
  const rawPosts=Array.isArray(d)?d:(d.posts||[]), rawInv=d.customInventory||[];
  return {version:7,updatedAt:d.exportedAt||now,config:{cadence:"Mon/Wed/Fri + event specials",timezone:"America/Los_Angeles",themes:Object.fromEntries(Object.entries(THEME).map(([k,v])=>[k,{color:v.color,label:v.label}]))},markers:Object.fromEntries(Object.entries(MARKERS).map(([date,value])=>[date,Array.isArray(value)?value.map(markerToData):markerToData(value)])),posts:rawPosts.map(p=>appToDataItem({...p,updatedAt:p.updatedAt||d.exportedAt||now},"post")),inventory:rawInv.map(it=>appToDataItem({...it,updatedAt:it.updatedAt||d.exportedAt||now},"inventory")),comments:normalizeCommentKeys(d.comments||comments||{})};
}
function normalizeCommentKeys(input){const out={};Object.entries(input||{}).forEach(([key,list])=>{const k=key.startsWith("inv-inv-")?key.slice(4):key;out[k]=Array.isArray(list)?list:[];});return out;}
function buildPayload(){cleanupComments();return stateToData();}
function rememberSync(d){const t=d&&(d.updatedAt||d.exportedAt);if(t)storage.set(LAST_SYNC_KEY,t);}
function mergeByUpdatedAt(localItems,remoteItems){
  const map=new Map(localItems.map(it=>[it.id,it]));
  remoteItems.forEach(remote=>{const local=map.get(remote.id);if(!local||Date.parse(remote.updatedAt||0)>=Date.parse(local.updatedAt||0))map.set(remote.id,remote);});
  return [...map.values()];
}
function mergeComments(a,b){const out={...normalizeCommentKeys(a)};Object.entries(normalizeCommentKeys(b)).forEach(([key,list])=>{const seen=new Set((out[key]||[]).map(c=>c.id));out[key]=[...(out[key]||[])];list.forEach(c=>{if(!seen.has(c.id)){out[key].push(c);seen.add(c.id);}});});return out;}
function applyPayload(d,merge){
  if(!d)return false;
  const incoming=d.version===7?d:migrateV6(d);
  if(merge){const local=stateToData();incoming.posts=mergeByUpdatedAt(local.posts,incoming.posts);incoming.inventory=mergeByUpdatedAt(local.inventory,incoming.inventory);incoming.comments=mergeComments(local.comments,incoming.comments);incoming.updatedAt=[local.updatedAt,incoming.updatedAt].sort().pop();}
  if(!dataToState(incoming))return false;
  rememberSync(incoming);return true;
}
function cleanupComments(){
  const valid=new Set(posts.map(p=>p.id));allInv().forEach(it=>valid.add(it.id));
  let changed=false;Object.keys(comments).forEach(k=>{if(!valid.has(k)){delete comments[k];changed=true;}});
  if(changed)saveComments();
}

async function loadInitialData(){
  const localPosts=storage.getJSON(STORE_KEY,null), localInv=storage.getJSON(INV_CUSTOM_KEY,[]), localComments=loadComments();
  const res=await fetch("data/calendar.json?t="+(+new Date()),{cache:"no-store"});
  if(!res.ok)throw new Error("Could not load data/calendar.json");
  const remote=await res.json();
  initialData=JSON.parse(JSON.stringify(remote));   // pristine remote for Reset — captured before local edits merge in
  dataToState(remote);
  // Reconcile any pre-existing local edits (v6 or v7 localStorage) into the freshly-loaded remote,
  // deduped by id via mergeByUpdatedAt — local custom inventory must survive, not be overwritten.
  if(localPosts||(localInv&&localInv.length)||Object.keys(localComments||{}).length){applyPayload({version:6,exportedAt:storage.get(LAST_SYNC_KEY)||"",posts:localPosts||[],customInventory:localInv||[],comments:localComments},true);}
}
function touchItem(item){item.updatedAt=nowISO();return item;}
function save(){posts.forEach(p=>{if(!p.updatedAt)p.updatedAt=nowISO();});customInv.forEach(it=>{if(!it.updatedAt)it.updatedAt=nowISO();});storage.setJSON(STORE_KEY,posts);saveCustom();render();}
function parseActivity(text){return text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map(line=>{try{return JSON.parse(line);}catch(e){return null;}}).filter(Boolean);}
async function loadActivity(){try{const res=await fetch("data/activity.jsonl?t="+(+new Date()),{cache:"no-store"});if(res.ok){activity=parseActivity(await res.text());renderActivity();}}catch(e){}}
function actionLabel(a){return ({add:"Added",schedule:"Scheduled",move:"Moved",set:"Updated",rm:"Removed","import-canva":"Imported Canva",migrate:"Migrated",publish:"Published"})[a]||a;}
function renderActivity(){const list=document.getElementById("activityList"),status=document.getElementById("activityStatus");if(!list)return;const recent=[...activity].sort((a,b)=>String(b.ts).localeCompare(String(a.ts))).slice(0,8);status.textContent=recent.length?recent.length+" latest":"";list.innerHTML=recent.map(e=>'<div class="activity-item"><span>'+esc(actionLabel(e.action))+'</span><b>'+esc(e.title||e.id||"")+'</b><time>'+esc(new Date(e.ts).toLocaleDateString())+'</time></div>').join("")||'<div class="activity-empty">No activity yet.</div>';}
function uid(){return "p-"+Date.now().toString(36)+Math.floor(Math.random()*1e4).toString(36);}
function localDateKey(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function safeURL(value,kind){
  const raw=(value||"").trim();if(!raw)return "";
  if(/^javascript:/i.test(raw)||(/^data:/i.test(raw)&&kind!=="img"))return "";
  if(kind==="img"){
    if(/^data:image\//i.test(raw)||/^https?:\/\//i.test(raw)||/^\.\.?\//.test(raw)||/^[\w./~ -]+$/i.test(raw))return raw;
    return "";
  }
  if(/^https?:\/\//i.test(raw))return raw;
  if(kind==="file"&&(/^file:\/\//i.test(raw)||raw.startsWith("~/")||raw.startsWith("/")))return raw.startsWith("file://")?raw:"file://"+raw.replace(/^~/,"/Users/morganbrown");
  return "";
}
function canvaURL(c){if(!c)return null;const raw=c.trim();const id=extractCanvaId(raw);return safeURL(raw,"href")||(id?"https://www.canva.com/design/"+id+"/view":null);}
function fileURL(v){return safeURL(v,"file");}
function parse(d){const a=d.split("-").map(Number);return new Date(a[0],a[1]-1,a[2]);}
function fmtFull(d){const dt=parse(d);return DOW[dt.getDay()]+", "+MON3[dt.getMonth()]+" "+dt.getDate();}
function esc(s){return (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");}
function escAttr(s){return esc(s);}
function markersFor(date){const m=MARKERS[date];return Array.isArray(m)?m:(m?[m]:[]);}
function slidesOf(p){return (p.slides&&p.slides.length)?p.slides:(p.img?[p.img]:[]);}
function isVideo(p){return !!p.video;}
function isLocalOnlyVideo(p){return !!(p.localOnly||/^~\//.test(p.video||""));}

/* ===== STATS ===== */
function stats(){
  document.getElementById("s-posts").textContent=posts.length;
  const vis=allInv().filter(it=>!invHidden.has(it.id)).length, nw=newInvCount();
  document.getElementById("btn-inv").innerHTML="Unscheduled ("+vis+")"+(nw?'<span class="newdot" title="'+nw+' new">'+nw+'</span>':'');
  if(!posts.length){document.getElementById("s-range").textContent="—";return;}
  const s=[...posts].sort((a,b)=>a.date.localeCompare(b.date));
  const a=parse(s[0].date),b=parse(s[s.length-1].date);
  document.getElementById("s-range").textContent=MON3[a.getMonth()]+" "+a.getDate()+" – "+MON3[b.getMonth()]+" "+b.getDate();
  updateDataAsOf();
}
function statusLabel(s){return ({draft:"Draft",ready:"Ready",scheduled:"Scheduled",posted:"Posted"})[s||""]||"Ready";}
function statusChip(p){return '<span class="status-chip st-'+escAttr(p.status||"ready")+'">'+esc(statusLabel(p.status))+'</span>';}
function updateDataAsOf(){const el=document.getElementById("dataAsOf");if(!el)return;const raw=storage.get("opendoor_calendar_updated_at");el.textContent="data as of "+(raw?new Date(raw).toLocaleString():"local edits")+" · Sync ↓ for latest";}
function schedTitles(){return new Set(posts.map(p=>p.title));}

/* ===== MONTH GRID ===== */
function buildGrid(){
  document.getElementById("monthLabel").textContent=MONTHS[viewM]+" "+viewY;
  const grid=document.getElementById("grid");
  const firstDow=new Date(viewY,viewM,1).getDay();
  const days=new Date(viewY,viewM+1,0).getDate();
  let html="";
  for(let i=0;i<firstDow;i++)html+='<div class="cell dim"></div>';
  for(let d=1;d<=days;d++){
    const ds=viewY+"-"+String(viewM+1).padStart(2,"0")+"-"+String(d).padStart(2,"0");
    let inner='<div class="daynum">'+d+'</div>';
    markersFor(ds).forEach(m=>{inner+='<div class="marker mk-'+escAttr(markerType(m.t))+'">'+esc(m.l)+'</div>';});
    posts.filter(p=>p.date===ds).forEach(p=>{
      const t=THEME[p.theme]||THEME.meme;
      const cc=comments[p.id]?comments[p.id].length:0;
      inner+='<div class="chip '+(p.status==="posted"?'posted':'')+'" draggable="true" data-id="'+escAttr(p.id)+'" data-action="open-preview" style="border-left-color:'+escAttr(t.color)+'">'+
             '<img src="'+escAttr(safeURL(p.img,"img"))+'" alt="">'+
             '<span class="ct">'+(isVideo(p)?'▶ ':'')+esc(p.title)+'</span>'+
             statusChip(p)+
             (cc?'<span class="chip-comment">💬 '+cc+'</span>':'')+'</div>';
    });
    html+='<div class="cell'+(ds===TODAY?" today":"")+'" data-date="'+ds+'">'+inner+'</div>';
  }
  const rem=(7-((firstDow+days)%7))%7; for(let i=0;i<rem;i++)html+='<div class="cell dim"></div>';
  grid.innerHTML=html; wireDnD();
}
let dragId=null;
function wireDnD(){
  document.querySelectorAll(".chip[draggable]").forEach(ch=>{
    ch.addEventListener("dragstart",e=>{dragId=ch.dataset.id;ch.classList.add("dragging");e.dataTransfer.effectAllowed="move";});
    ch.addEventListener("dragend",()=>{ch.classList.remove("dragging");dragId=null;});
  });
  document.querySelectorAll(".cell[data-date]").forEach(cell=>{
    cell.addEventListener("dragover",e=>{e.preventDefault();cell.classList.add("dragover");});
    cell.addEventListener("dragleave",()=>cell.classList.remove("dragover"));
    cell.addEventListener("drop",e=>{e.preventDefault();cell.classList.remove("dragover");
      if(!dragId)return;const p=posts.find(x=>x.id===dragId);
      if(p&&p.date!==cell.dataset.date){p.date=cell.dataset.date;p.status=p.status||"scheduled";touchItem(p);save();}});
  });
}

/* ===== LIST ===== */
function weekStart(d){const dt=parse(d);dt.setDate(dt.getDate()-dt.getDay());return dt;}
function postCard(p){
  const t=THEME[p.theme]||THEME.meme;
  const when=p.holiday?'<div class="when" style="background:'+escAttr(t.color)+'">'+fmtFull(p.date)+' · '+esc(p.holiday)+'</div>':'<div class="when">'+fmtFull(p.date)+'</div>';
  return '<div class="card '+(p.status==="posted"?'posted':'')+'" data-action="open-preview" data-id="'+escAttr(p.id)+'"><div class="thumb">'+when+
    '<div class="tags">'+(isVideo(p)?'<span class="vbadge">▶ VIDEO</span>':'')+(isLocalOnlyVideo(p)?'<span class="vbadge local">LOCAL ONLY</span>':'')+'</div>'+
    '<img src="'+escAttr(safeURL(p.img,"img"))+'" alt="" loading="lazy">'+
    (isVideo(p)?'<div class="play"><span></span></div>':'')+'</div>'+
    '<div class="cbody"><div class="ctop"><span class="badge '+escAttr(t.cls)+'">'+esc(t.label)+'</span>'+statusChip(p)+'<span class="fmt">'+esc(p.fmt||"")+'</span></div>'+
    '<div class="ctitle">'+esc(p.title)+'</div><div class="caption">'+esc(p.caption||"")+'</div></div></div>';
}
function buildList(){
  const v=document.getElementById("listView");
  if(!posts.length){v.innerHTML='<p style="color:var(--muted)">No posts yet.</p>';return;}
  const g={}; posts.forEach(p=>{const k=weekStart(p.date).getTime();(g[k]=g[k]||{ws:weekStart(p.date),items:[]}).items.push(p);});
  let html="";
  Object.keys(g).map(Number).sort((a,b)=>a-b).forEach(k=>{
    const grp=g[k],ws=grp.ws,we=new Date(ws);we.setDate(we.getDate()+6);
    grp.items.sort((a,b)=>a.date.localeCompare(b.date));
    html+='<div class="week"><h3>Week of '+MON3[ws.getMonth()]+' '+ws.getDate()+' – '+MON3[we.getMonth()]+' '+we.getDate()+', '+we.getFullYear()+'</h3><div class="cards">'+
          grp.items.map(postCard).join("")+'</div></div>';
  });
  v.innerHTML=html;
}

/* ===== INVENTORY ===== */
function buildInv(){
  const scheduled=schedTitles();
  document.getElementById("invCards").innerHTML=allInv().map(it=>{
    if(invHidden.has(it.id))return "";
    const t=THEME[it.theme]||THEME.meme;
    const done=scheduled.has(it.title);
    return '<div class="card"><div class="thumb" data-action="open-preview-inv" data-id="'+escAttr(it.id)+'">'+
      '<button class="inv-del" title="Remove from inventory" data-action="delete-inv" data-id="'+escAttr(it.id)+'">×</button>'+
      '<div class="tags">'+(it.builtin?"":'<span class="vbadge" style="background:rgba(31,128,255,.92)">ADDED</span>')+(it.video?'<span class="vbadge">▶ VIDEO</span>':'')+(isLocalOnlyVideo(it)?'<span class="vbadge local">LOCAL ONLY</span>':'')+'</div>'+
      '<img src="'+escAttr(safeURL(it.img,"img"))+'" alt="" loading="lazy">'+
      (it.video?'<div class="play"><span></span></div>':'')+
      (done?'<span class="sched-pill">✓ Scheduled</span>':'')+'</div>'+
      '<div class="cbody"><div class="ctop"><span class="badge '+escAttr(t.cls)+'">'+esc(t.label)+'</span>'+statusChip(it)+'<span class="fmt">'+esc(it.fmt||"")+'</span></div>'+
      '<div class="ctitle">'+esc(it.title)+'</div><div class="caption">'+esc(it.caption||"")+'</div>'+
      '<button class="cta" data-action="add-from-inv" data-id="'+escAttr(it.id)+'">'+(done?'Add again →':'Add to schedule →')+'</button></div></div>';
  }).join("");
  const hid=invHidden.size;
  document.getElementById("invHdrNote").innerHTML = hid
    ? '<b>'+hid+' removed.</b> <span class="restore" data-action="restore-inv">Restore all</span>'
    : "";
}
function findInv(id){return allInv().find(x=>x.id===id);}
function deleteInv(id){const it=findInv(id);if(it&&confirm('Remove "'+it.title+'" from inventory? You can restore it later.')){invHidden.add(id);saveHidden();stats();buildInv();}}
function restoreInv(){if(confirm("Restore all removed inventory items?")){invHidden.clear();saveHidden();stats();buildInv();}}
function addInventory(){
  const it=findInv(document.getElementById("f-id").value); // null when new
  fillForm(it||{theme:"brand",fmt:"Static · 4:5"});
  modalMode="inv"; pendingExtra=null;
  document.getElementById("modalTitle").textContent="Add inventory item";
  document.getElementById("f-dateField").style.display="none";
  document.getElementById("f-holidayField").style.display="none";
  document.getElementById("f-delete").style.display="none";
  document.getElementById("overlay").classList.add("open");
}
function showPostFields(){document.getElementById("f-dateField").style.display="";document.getElementById("f-holidayField").style.display="";}

/* ===== LIGHTBOX ===== */
function openPreview(id){const p=posts.find(x=>x.id===id); if(p)showLB(p,id);}
function openPreviewInv(id){const it=findInv(id);if(it)showLB(it,null);}
function showLB(item,id){
  lbItem=Object.assign({_id:id},item); lbIdx=0; lbSlides=slidesOf(item);
  const t=THEME[item.theme]||THEME.meme;
  document.getElementById("lbBadge").className="badge "+t.cls; document.getElementById("lbBadge").textContent=t.label;
  document.getElementById("lbTitle").textContent=item.title;
  document.getElementById("lbFmt").textContent=(item.date?fmtFull(item.date)+" · ":"")+(item.fmt||"");
  document.getElementById("lbCaption").textContent=item.caption||"";
  const scEl=document.getElementById("lbSocialCaption");const scTxt=document.getElementById("lbSocialCaptionText");
  if(item.socialCaption){scEl.style.display="";scTxt.textContent=item.socialCaption;}else{scEl.style.display="none";}
  const acts=[];
  if(item.canva){const href=canvaURL(item.canva);if(href)acts.push('<a class="canva" target="_blank" rel="noopener" href="'+escAttr(href)+'">Open in Canva ↗</a>');}
  if(item.video){const href=fileURL(item.video);if(href)acts.push('<a target="_blank" rel="noopener" href="'+escAttr(href)+'">▶ '+(isLocalOnlyVideo(item)?'Open local video (Morgan only)':'Open video file')+'</a>');}
  if(item.file){const href=fileURL(item.file);if(href)acts.push('<a target="_blank" rel="noopener" href="'+escAttr(href)+'">Open file ↗</a>');}
  if(id)acts.push('<button data-action="edit-post" data-id="'+escAttr(id)+'">Edit details</button>');
  else {acts.push('<button data-action="add-from-lb-inv">Add to schedule →</button>');
        if(item.builtin===false)acts.push('<button data-action="edit-inv" data-id="'+escAttr(item.id)+'">Edit item</button>');}
  document.getElementById("lbActs").innerHTML=acts.join("");
  if(item.status==="posted"&&item.postedUrl){const href=safeURL(item.postedUrl,"href");if(href)document.getElementById("lbActs").insertAdjacentHTML("afterbegin",'<a target="_blank" rel="noopener" href="'+escAttr(href)+'">Open posted link ↗</a>');}
  renderComments(commentKey(id));
  renderLBMedia();
  document.getElementById("lb").classList.add("open");
}
function renderLBMedia(){
  const m=document.getElementById("lbMedia");
  if(isVideo(lbItem)){
    m.innerHTML='<video controls autoplay playsinline src="'+escAttr(fileURL(lbItem.video))+'" poster="'+escAttr(safeURL(lbItem.img,"img"))+'"></video>'+(isLocalOnlyVideo(lbItem)?'<div class="local-note">Plays on Morgan\'s machine only until this mp4 is uploaded.</div>':'');
    document.getElementById("lbPrev").style.visibility="hidden"; document.getElementById("lbNext").style.visibility="hidden";
    document.getElementById("lbCounter").textContent="";
  } else {
    m.innerHTML='<img src="'+escAttr(safeURL(lbSlides[lbIdx]||lbItem.img,"img"))+'" alt="">';
    const multi=lbSlides.length>1;
    document.getElementById("lbPrev").style.visibility=multi?"visible":"hidden";
    document.getElementById("lbNext").style.visibility=multi?"visible":"hidden";
    document.getElementById("lbCounter").textContent=multi?("Slide "+(lbIdx+1)+" of "+lbSlides.length):"";
  }
}
function lbStep(n){if(!lbSlides.length)return;lbIdx=(lbIdx+n+lbSlides.length)%lbSlides.length;renderLBMedia();}
function closeLB(){const m=document.getElementById("lbMedia");m.innerHTML="";document.getElementById("lb").classList.remove("open");}

/* ===== MODAL ===== */
function openAdd(prefill){
  modalMode="post"; showPostFields();
  pendingExtra=prefill?{slides:prefill.slides,file:prefill.file}:null;
  const base=prefill?{title:prefill.title,theme:prefill.theme,fmt:prefill.fmt,caption:prefill.caption,socialCaption:prefill.socialCaption,canva:prefill.canva,video:prefill.video,img:prefill.img}:{theme:"meme",fmt:"Static · 3:4"};
  fillForm({id:"",date:viewY+"-"+String(viewM+1).padStart(2,"0")+"-01",...base});
  document.getElementById("modalTitle").textContent=prefill?"Add to schedule":"Add post";
  document.getElementById("f-delete").style.display="none";
  document.getElementById("overlay").classList.add("open");
}
function openEdit(id){const p=posts.find(x=>x.id===id);if(!p)return;modalMode="post";showPostFields();pendingExtra=null;fillForm(p);
  document.getElementById("modalTitle").textContent="Edit post";
  document.getElementById("f-delete").style.display="inline-block";
  document.getElementById("overlay").classList.add("open");}
function editInvItem(id){const it=findInv(id);if(!it||it.builtin)return;pendingExtra=null;fillForm(it);
  modalMode="inv";
  document.getElementById("modalTitle").textContent="Edit inventory item";
  document.getElementById("f-dateField").style.display="none";
  document.getElementById("f-holidayField").style.display="none";
  document.getElementById("f-delete").style.display="inline-block";
  document.getElementById("overlay").classList.add("open");}
function fillForm(p){
  f("id",p.id||"");f("title",p.title||"");f("date",p.date||"");f("theme",p.theme||"meme");
  f("fmt",p.fmt||"");f("holiday",p.holiday||"");f("status",p.status||("date" in p?"scheduled":"ready"));f("postedUrl",p.postedUrl||"");f("caption",p.caption||"");f("socialCaption",p.socialCaption||"");f("canva",p.canva||"");
  f("video",p.video||p.file||"");f("img",p.img||"");syncPrev();
  showCanvaStatus("","");toggleCanvaPushRow();
}
function f(id,val){document.getElementById("f-"+id).value=val;}
function syncPrev(){const i=document.getElementById("f-prevImg");i.src=safeURL(document.getElementById("f-img").value,"img");i.style.visibility="visible";}
function uploadPrev(e){const file=e.target.files[0];if(!file)return;
  if(file.size>UPLOAD_MAX_BYTES){alert("Preview uploads are capped at 300 KB. Add optimized preview files to previews/ and use that path instead.");e.target.value="";return;}
  const r=new FileReader();r.onload=()=>{document.getElementById("f-img").value=r.result;syncPrev();};r.readAsDataURL(file);}
function closeModal(){document.getElementById("overlay").classList.remove("open");}
function savePost(){
  const title=document.getElementById("f-title").value.trim();
  if(!title){alert("Title is required.");return;}
  const vid=document.getElementById("f-video").value.trim();
  const base={title,theme:document.getElementById("f-theme").value,fmt:document.getElementById("f-fmt").value.trim(),
    status:document.getElementById("f-status").value,postedUrl:document.getElementById("f-postedUrl").value.trim(),
    caption:document.getElementById("f-caption").value.trim(),socialCaption:document.getElementById("f-socialCaption").value.trim(),
    canva:document.getElementById("f-canva").value.trim(),
    img:document.getElementById("f-img").value.trim()};
  // treat .mp4/.mov/.webm as a playable video, anything else as a generic file link
  if(/\.(mp4|mov|webm|m4v)$/i.test(vid)){base.video=vid;} else if(vid){base.file=vid;}
  const id=document.getElementById("f-id").value;
  if(modalMode==="inv"){                       // create/update a custom inventory item
    const existing=id?customInv.find(x=>x.id===id):null;
    if(existing)Object.assign(existing,touchItem(base)); else customInv.push(touchItem({id:uid(),...base}));
    saveCustom();closeModal();setView('inv');render();return;
  }
  const date=document.getElementById("f-date").value;
  if(!date){alert("Date is required.");return;}
  const fields={...base,date,holiday:document.getElementById("f-holiday").value.trim()};
  if(id){Object.assign(posts.find(x=>x.id===id),touchItem(fields));}
  else{const np=touchItem({id:uid(),...fields});if(pendingExtra){if(pendingExtra.slides)np.slides=pendingExtra.slides;if(pendingExtra.file)np.file=pendingExtra.file;}
       posts.push(np);const dt=parse(date);viewY=dt.getFullYear();viewM=dt.getMonth();}
  pendingExtra=null;closeModal();save();
}
function deletePost(){const id=document.getElementById("f-id").value;
  if(modalMode==="inv"){if(id&&confirm("Delete this inventory item?")){customInv=customInv.filter(x=>x.id!==id);saveCustom();closeModal();setView('inv');render();}return;}
  if(id&&confirm("Delete this post?")){posts=posts.filter(x=>x.id!==id);delete comments[id];saveComments();closeModal();save();}}
function addFromInvId(id){const it=findInv(id);if(it){setView('month');openAdd(it);}}
function addFromInvItem(){openAdd(lbItem);}

/* ===== VIEW / EXPORT ===== */
function render(){stats();buildGrid();buildList();buildInv();renderActivity();}
function setView(v){view=v;
  document.getElementById("monthView").style.display=v==="month"?"block":"none";
  document.getElementById("listView").style.display=v==="list"?"block":"none";
  document.getElementById("invViewSec").style.display=v==="inv"?"block":"none";
  document.getElementById("btn-month").classList.toggle("active",v==="month");
  document.getElementById("btn-list").classList.toggle("active",v==="list");
  document.getElementById("btn-inv").classList.toggle("active",v==="inv");
  if(v==="inv"){markInvSeen();stats();}   // opening the tab clears the "new" dot
}
function shiftMonth(n){viewM+=n;if(viewM<0){viewM=11;viewY--;}if(viewM>11){viewM=0;viewY++;}buildGrid();}
function goToday(){const d=parse(TODAY);viewY=d.getFullYear();viewM=d.getMonth();buildGrid();}
function exportJSON(){
  cleanupComments();
  const payload=buildPayload();
  const b=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="opendoor-content-calendar.json";a.click();
}
function importJSON(e){const file=e.target.files[0];if(!file)return;const r=new FileReader();
  r.onload=()=>{try{const d=JSON.parse(r.result);
    if(!applyPayload(d,true)){alert("Invalid file.");return;}
    cleanupComments();render();
  }catch(x){alert("Could not parse JSON.");}};
  r.readAsText(file);e.target.value="";}
function resetAll(){if(confirm("Reset to the committed calendar data? Discards local changes.")){if(initialData){dataToState(initialData);render();}else location.reload();}}

/* ===== TOAST ===== */
let toastT=null;
function toast(msg){const el=document.getElementById("toast");el.textContent=msg;el.classList.add("show");clearTimeout(toastT);toastT=setTimeout(()=>el.classList.remove("show"),3200);}

function handleAction(e){
  const el=e.target.closest("[data-action]");if(!el)return;
  const action=el.dataset.action;
  if(action!=="open-preview")e.stopPropagation();
  const id=el.dataset.id, step=Number(el.dataset.step||0);
  const actions={
    "open-add":()=>openAdd(),"set-view":()=>setView(el.dataset.view),"sync-down":()=>pullFromRepo(),"sync-up":()=>pushToRepo(),
    "export-json":()=>exportJSON(),"open-import":()=>document.getElementById("importer").click(),"reset-all":()=>resetAll(),
    "open-canva-import":()=>openCanvaImport(),"close-canva-import":()=>closeCanvaImport(),"parse-canva-import":()=>parseCanvaImports(),"save-canva-import":()=>saveCanvaImports(),
    "sample-canva-import":()=>sampleCanvaImport(),"clear-canva-import":()=>clearCanvaImport(),"remove-canva-import":()=>removeCanvaImport(el.dataset.index),
    "shift-month":()=>shiftMonth(step),"go-today":()=>goToday(),"add-inventory":()=>addInventory(),
    "copy-social-caption":()=>copySocialCaption(),"delete-post":()=>deletePost(),"close-modal":()=>closeModal(),"save-post":()=>savePost(),
    "close-lb":()=>closeLB(),"lb-step":()=>lbStep(step),"add-comment":()=>addComment(),"delete-comment":()=>deleteComment(el.dataset.commentId),
    "open-preview":()=>openPreview(id),"open-preview-inv":()=>openPreviewInv(id),"delete-inv":()=>deleteInv(id),"add-from-inv":()=>addFromInvId(id),
    "restore-inv":()=>restoreInv(),"edit-post":()=>{closeLB();openEdit(id);},"add-from-lb-inv":()=>{closeLB();addFromInvItem();},
    "edit-inv":()=>{closeLB();editInvItem(id);}
  };
  if(actions[action])actions[action]();
}

function handleInput(e){
  if(e.target.id==="f-socialCaption")toggleCanvaPushRow();
  if(e.target.id==="f-img")syncPrev();
  if(e.target.id==="canvaImportDestination"&&pendingCanvaImports.length)renderCanvaImportPreview();
  if(e.target.dataset.importField)updateCanvaImportField(e.target);
}

function handleImageError(e){if(e.target.tagName==="IMG")e.target.style.visibility="hidden";}

/* ===== PASSWORD GATE (deterrence only — source is public on Pages) =====
   Change the password: run  printf %s 'NEWPASS' | shasum -a 256  and paste the hash below. */
const GATE_HASH="dc7d2350f3beddb9fc85ad1c8a12b958a6fcd7128fe27765710136018e87db49"; // default password: opendoor2026
function sha256js(ascii){function rr(v,a){return (v>>>a)|(v<<(32-a));}var mp=Math.pow,maxWord=mp(2,32),result='';var words=[],bitLen=ascii.length*8;var hash=sha256js.h=sha256js.h||[],k=sha256js.k=sha256js.k||[],pc=k.length;var comp={};for(var cand=2;pc<64;cand++){if(!comp[cand]){for(var i=0;i<313;i+=cand)comp[i]=cand;hash[pc]=(mp(cand,.5)*maxWord)|0;k[pc++]=(mp(cand,1/3)*maxWord)|0;}}ascii+='\x80';while(ascii.length%64-56)ascii+='\x00';for(var i=0;i<ascii.length;i++){var j=ascii.charCodeAt(i);if(j>>8)return;words[i>>2]|=j<<((3-i)%4)*8;}words[words.length]=((bitLen/maxWord)|0);words[words.length]=(bitLen);for(var j=0;j<words.length;){var w=words.slice(j,j+=16),oldHash=hash;hash=hash.slice(0,8);for(var i=0;i<64;i++){var w15=w[i-15],w2=w[i-2];var a=hash[0],e=hash[4];var t1=hash[7]+(rr(e,6)^rr(e,11)^rr(e,25))+((e&hash[5])^((~e)&hash[6]))+k[i]+(w[i]=(i<16)?w[i]:(w[i-16]+(rr(w15,7)^rr(w15,18)^(w15>>>3))+w[i-7]+(rr(w2,17)^rr(w2,19)^(w2>>>10)))|0);var t2=(rr(a,2)^rr(a,13)^rr(a,22))+((a&hash[1])^(a&hash[2])^(hash[1]&hash[2]));hash=[(t1+t2)|0].concat(hash);hash[4]=(hash[4]+t1)|0;}for(var i=0;i<8;i++)hash[i]=(hash[i]+oldHash[i])|0;}for(var i=0;i<8;i++)for(var j=3;j+1;j--){var b=(hash[i]>>(j*8))&255;result+=((b<16)?0:'')+b.toString(16);}return result;}
async function sha256(s){const bytes=unescape(encodeURIComponent(s));
  if(window.crypto&&crypto.subtle){try{const buf=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));return [...new Uint8Array(buf)].map(x=>x.toString(16).padStart(2,"0")).join("");}catch(e){}}
  return sha256js(bytes);}
async function submitGate(e){e.preventDefault();const h=await sha256(document.getElementById("gatePass").value);
  if(h===GATE_HASH){storage.set("cal_gate_ok",h);document.getElementById("gate").style.display="none";initApp();}
  else{document.getElementById("gateErr").textContent="Incorrect password.";document.getElementById("gatePass").select();}}

/* ===== GITHUB SYNC (Pages + committed JSON) ===== */
const REPO={owner:"morganb180",repo:"opendoor-content-calendar",branch:"main",path:"data/calendar.json"};
function applyState(d){
  return applyPayload(d,true);}
function decodeGitHubContent(content){return JSON.parse(decodeURIComponent(escape(atob(content.replace(/\n/g,"")))));}
function encodeGitHubContent(payload){return btoa(unescape(encodeURIComponent(JSON.stringify(payload,null,2))));}
async function pullFromRepo(silent){
  try{const res=await fetch(REPO.path+"?t="+(+new Date()),{cache:"no-store"});if(!res.ok)throw 0;
    const d=await res.json();if(applyState(d)){cleanupComments();render();if(!silent)toast("Pulled latest from GitHub ✓");}}
  catch(e){if(!silent)toast("No shared data found yet — publish changes first.");}}
async function promptGitHubToken(api){
  let tok=storage.get(GH_TOKEN_KEY);if(tok)return tok;
  tok=prompt("Paste a GitHub token (fine-grained PAT with Contents: Read+Write on "+REPO.repo+").\nStored only after it passes a GitHub read test.");
  if(!tok)return null;tok=tok.trim();
  const test=await fetch(api+"?ref="+REPO.branch,{headers:{Authorization:"Bearer "+tok,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"}});
  if(test.status===401||test.status===403){toast("GitHub token rejected; not stored.");return null;}
  storage.set(GH_TOKEN_KEY,tok);return tok;
}
async function pushToRepo(){
  const api="https://api.github.com/repos/"+REPO.owner+"/"+REPO.repo+"/contents/"+REPO.path;
  const tok=await promptGitHubToken(api);if(!tok)return;
  cleanupComments();
  const H={Authorization:"Bearer "+tok,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"};
  toast("Merging and publishing to GitHub…");
  try{let sha;const g=await fetch(api+"?ref="+REPO.branch,{headers:H});
    if(g.status===401||g.status===403){storage.remove(GH_TOKEN_KEY);toast("GitHub token rejected; cleared.");return;}
    if(g.ok){const remote=await g.json();sha=remote.sha;if(remote.content){const remotePayload=decodeGitHubContent(remote.content);applyPayload(remotePayload,true);cleanupComments();render();}}
    const payload=buildPayload(), content=encodeGitHubContent(payload);
    const put=await fetch(api,{method:"PUT",headers:H,body:JSON.stringify({message:"Update calendar "+new Date().toISOString(),content,branch:REPO.branch,sha})});
    if(put.ok){rememberSync(payload);storage.set("opendoor_calendar_updated_at",payload.updatedAt);updateDataAsOf();await appendRemoteActivity(H,{ts:nowISO(),actor:"browser",action:"publish",id:"data/calendar.json",title:"Published calendar changes",detail:{posts:posts.length,inventory:customInv.length}});toast("Published to GitHub ✓ Other machines: Sync ↓");}
    else{const er=await put.json().catch(()=>({}));if(put.status===401||put.status===403){storage.remove(GH_TOKEN_KEY);}toast("Push failed: "+(er.message||put.status));}}
  catch(e){toast("Push error: "+e.message);}}
async function appendRemoteActivity(H,entry){
  const path="data/activity.jsonl",api="https://api.github.com/repos/"+REPO.owner+"/"+REPO.repo+"/contents/"+path;
  try{let sha,body="";const g=await fetch(api+"?ref="+REPO.branch,{headers:H});if(g.ok){const remote=await g.json();sha=remote.sha;body=decodeURIComponent(escape(atob(remote.content.replace(/\n/g,""))));}
    body+=(body&&!body.endsWith("\n")?"\n":"")+JSON.stringify(entry)+"\n";
    await fetch(api,{method:"PUT",headers:H,body:JSON.stringify({message:"Append calendar activity",content:btoa(unescape(encodeURIComponent(body))),branch:REPO.branch,sha})});
    activity.push(entry);renderActivity();}
  catch(e){}
}

/* ===== INIT ===== */
async function initApp(){
  document.getElementById("overlay").addEventListener("click",e=>{if(e.target.id==="overlay")closeModal();});
  document.getElementById("canvaImportOverlay").addEventListener("click",e=>{if(e.target.id==="canvaImportOverlay")closeCanvaImport();});
  document.getElementById("lb").addEventListener("click",e=>{if(e.target.id==="lb")closeLB();});
  document.addEventListener("click",handleAction);
  document.addEventListener("input",handleInput);
  document.addEventListener("error",handleImageError,true);
  document.getElementById("gateForm").addEventListener("submit",submitGate);
  document.getElementById("importer").addEventListener("change",importJSON);
  document.getElementById("f-uploadPrev").addEventListener("change",uploadPrev);
  document.getElementById("lbCommentInput").addEventListener("keydown",e=>{if(e.key==="Enter")addComment();});
  document.addEventListener("keydown",e=>{if(document.getElementById("lb").classList.contains("open")){if(e.key==="Escape")closeLB();if(e.key==="ArrowLeft")lbStep(-1);if(e.key==="ArrowRight")lbStep(1);}});
  try{await loadInitialData();await loadActivity();}
  catch(e){toast(e.message||"Could not load calendar data.");}
  render();
  document.getElementById("foot").innerHTML=
    "<b>Preview:</b> click any post (or inventory item) to open it full-size — carousels are swipeable (‹ ›/arrow keys), videos play inline. "+
    "<b>Schedule:</b> drag posts between days; click → <b>Edit details</b>. <b>+ Add post</b> / <b>+ Add inventory item</b> for new content; use ‹ › for future months. "+
    "<br><b>Sync across machines:</b> <b>Publish changes</b> writes <code>data/calendar.json</code> to GitHub (asks once for a token, stored only in this browser); <b>Sync ↓</b> pulls the latest. The app loads the committed data file on every open. "+
    "<b>Export/Import</b> JSON also works for manual backup. "+
    "<br><b>Holidays/events</b> show as colored tags and update as you navigate months. Canva posts open <code>canva.com/design/&lt;id&gt;/view</code>. "+
    "<b>Social captions:</b> add the actual IG/FB caption in the edit form, then use <b>Copy caption</b> to paste into Canva. "+
    "<b>Comments:</b> leave internal feedback on any post or inventory item in the preview panel — comments sync with Publish changes / Sync ↓. "+
    "<i>Note: local-only videos are labeled; image previews &amp; carousels work on the hosted site.</i>";
}
// gate startup
if(storage.get("cal_gate_ok")===GATE_HASH){document.getElementById("gate").style.display="none";initApp();}
else{document.getElementById("gate").style.display="grid";document.getElementById("gatePass").focus();}
