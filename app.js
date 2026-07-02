const STORE_KEY="opendoor_calendar_v2";
const COMMENTS_KEY="opendoor_comments_v1";      // {postId: [{id,text,author,ts}]}
const COMMENT_AUTHOR_KEY="opendoor_comment_author";
const LAST_SYNC_KEY="opendoor_last_sync_exported_at";
const GH_TOKEN_KEY="gh_pat";
const CANVA_TOKEN_KEY="canva_connect_token";
const CANVA_CAPTION_FIELD_KEY="canva_caption_field";
const TODAY="2026-06-30";
const THEME={
  seasonal:{cls:"b-seasonal",color:"#ff7a45",label:"Seasonal"},
  worldcup:{cls:"b-worldcup",color:"#16a34a",label:"World Cup"},
  meme:{cls:"b-meme",color:"#7c3aed",label:"Meme"},
  proof:{cls:"b-proof",color:"#0ea5e9",label:"Proof"},
  brand:{cls:"b-brand",color:"#1f80ff",label:"Brand"},
};
/* Holidays & big events — {label, type: hol|evt|mkt} */
const MARKERS={
  "2026-07-01":{l:"⚽ USA vs Bosnia · R32",t:"evt"},
  "2026-07-04":{l:"🇺🇸 Independence Day",t:"hol"},
  "2026-07-11":{l:"⚽ Quarter-finals",t:"evt"},
  "2026-07-12":{l:"🎾 Wimbledon Final",t:"evt"},
  "2026-07-15":{l:"⚽ Semi-finals",t:"evt"},
  "2026-07-19":{l:"⚽ World Cup Final",t:"evt"},
  "2026-08-17":{l:"🎒 Back-to-school season",t:"mkt"},
  "2026-09-07":{l:"Labor Day",t:"hol"},
  "2026-10-12":{l:"Indigenous Peoples’ Day",t:"hol"},
  "2026-10-31":{l:"🎃 Halloween",t:"evt"},
  "2026-11-03":{l:"🗳️ Election Day",t:"evt"},
  "2026-11-11":{l:"Veterans Day",t:"hol"},
  "2026-11-26":{l:"🦃 Thanksgiving",t:"hol"},
  "2026-11-27":{l:"🛍️ Black Friday",t:"mkt"},
  "2026-12-25":{l:"🎄 Christmas",t:"hol"},
  "2026-12-31":{l:"🎉 New Year’s Eve",t:"evt"},
  "2027-01-01":{l:"New Year’s Day",t:"hol"},
};
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
const P="previews/", S="previews/slides/";
const seq=(base,n,ext)=>Array.from({length:n},(_,i)=>S+base+"-"+(i+1)+"."+(ext||"png"));

const DEFAULTS=[
  {date:"2026-07-01",title:"Are You Busy This Month?",theme:"meme",fmt:"Carousel · 2 slides",
   img:P+"busy-month.png",slides:seq("busy",2),canva:"DAHN-8eHiBA",
   caption:"Monthly opener. Packed calendar of chores vs. a wide-open beach month with Opendoor."},
  {date:"2026-07-01",title:"World Cup — The Leading O Becomes the Ball",theme:"worldcup",fmt:"Video · 9:16",holiday:"USA · 1st knockout",
   img:P+"worldcup.png",canva:"DAHOFqh_g5g",
   caption:"⚽ Always rooting for the home team — we're on your side when you make your move. (USA vs. Bosnia & Herzegovina, the US's first knockout match, Round of 32, Levi's Stadium.)"},
  {date:"2026-07-02",title:"Skip the Circus — Banner Drop",theme:"meme",fmt:"Static · 3:4",
   img:P+"skip-circus.png",
   caption:"Reskin of the viral banner-drop stunt (Blue Apron 'hot dogs' post): masked climbers atop a skyscraper mast unfurl a flag reading 'Skip the circus / Skip straight to sold / opendoor.com.' Deadpan, screenshot-y — 'wait, is this real?' energy. Scheduled for AM.",
   socialCaption:"some people really love Opendoor"},
  {date:"2026-07-02",title:"Wimbledon — The Grass Is Truly Greener",theme:"seasonal",fmt:"Static · 3:4",holiday:"🎾 Wimbledon",
   img:P+"wimbledon-doors.png",canva:"DAHOKZYzGc4",
   caption:"🎾 Grass-season brand post for Wimbledon week 1. A 3×3 grid of green front doors (middle-America mix); 'the grass is truly greener' on the other side of an Opendoor."},
  {date:"2026-07-03",title:"Some Things Just Go Together — July",theme:"seasonal",fmt:"Static · 3:4",
   img:P+"go-together-july.png",canva:"DAHN_aEi-KM",
   caption:"Hot dogs + the 4th. Home + Opendoor. The 'go together' series, July edition."},
  {date:"2026-07-04",title:"Fireworks Wordmark",theme:"seasonal",fmt:"Video · 9:16",holiday:"July 4th",
   img:P+"fireworks.png",canva:"DAHOFu7Evxs",
   caption:"🎆 Independence Day hero post. Opendoor wordmark amongst the fireworks finale. (3 cuts: gold / finale / blue.)"},
  {date:"2026-07-06",title:"Doctor's Rx — \"opendoor.com\"",theme:"meme",fmt:"Static · 3:4",
   img:P+"doctor-rx.png",canva:"DAHOClozijM",
   caption:"iMessage meme. Relatable hook with the opendoor.com punchline."},
  {date:"2026-07-08",title:"Based On My Calculations…",theme:"meme",fmt:"Carousel · 7 slides",
   img:P+"calculator-carousel.png",slides:seq("calc",7),canva:"DAHN-WGEddY",
   caption:"Calculator-meme carousel — what selling the old way really 'costs' you."},
  {date:"2026-07-10",title:"Today's Forecast: 100% Chance of an Offer",theme:"seasonal",fmt:"Static · 3:4",
   img:P+"forecast-offer.png",canva:"DAHOECZyDlE",
   caption:"Summer weather-meme. Sunny, optimistic."},
  {date:"2026-07-12",title:"Wimbledon — Your Own Center Court",theme:"seasonal",fmt:"Static · 3:4",holiday:"🎾 Wimbledon Final",
   img:P+"wimbledon-centercourt.png",canva:"DAHOKau9MAw",
   caption:"🎾 Finals-day post (Gentlemen's Singles Final). Photoreal striped-lawn backyard: 'the best seat this summer is your own Center Court.'"},
  {date:"2026-07-13",title:"Things That Go Together",theme:"meme",fmt:"Static · 3:4",
   img:P+"go-together-home.png",canva:"DAHN-Qf43Ko",
   caption:"PB&J / flag & apple pie / home & Opendoor. The evergreen anchor of the series."},
  {date:"2026-07-15",title:"Real Progress — Hero + Camera Roll",theme:"brand",fmt:"Static · 3:4",
   img:P+"real-progress-hero.png",canva:"DAHODWLscvU",
   caption:"Warm, human brand-story beat to balance the meme run."},
  {date:"2026-07-17",title:"Red Card — Selling the Old Way",theme:"worldcup",fmt:"Carousel · 7 slides",holiday:"World Cup knockouts",
   img:S+"redcard-1.jpg",slides:seq("redcard",7,"jpg"),canva:"DAHOFdzTB74",
   caption:"⚽ Soccer-ref 'red card' carousel timed to the later World Cup rounds (semis Jul 14–15 → final Jul 19). 6 old-way clichés + a goal-celebration Opendoor payoff slide."},
  {date:"2026-07-19",title:"Jersey Crest Reveal — Circular Ring",theme:"worldcup",fmt:"Video · 9:16",holiday:"World Cup Final",
   img:P+"jersey-crest-circular.png",canva:"DAHORwReEzA",
   video:"https://raw.githubusercontent.com/morganb180/canva-asset-host/main/assets/crest_circular_ring_take1-ae33672a49.mp4",
   caption:"Final-day World Cup tie-in. Macro satin-stitch embroidery timelapse: an Opendoor circular crest (O door-mark, arced 'OPENDOOR', two stars) self-stitches onto a cobalt-blue jersey over the heart, like a team patch, not a sponsor logo. Gemini omni-flash native video.",
   socialCaption:"Kitted up. Ready to help you make your move."},
  {date:"2026-07-20",title:"\"I Said Try opendoor.com\"",theme:"meme",fmt:"Carousel · 12 slides",
   img:P+"try-opendoor-series.png",slides:seq("try",12),canva:"DAHOCjs2zTE",
   caption:"Text-exchange series. High-save, screenshot-y format."},
  {date:"2026-07-22",title:"Price-Cut Cards (Jun 2026)",theme:"proof",fmt:"Carousel · 7 slides",
   img:P+"price-cut-cards.png",slides:seq("price",7),canva:"DAHN_TrpnVc",
   caption:"Per-market price-cut charts. Data/credibility post — real numbers."},
  {date:"2026-07-24",title:"Group-Text \"opendoor.com\" Memes",theme:"meme",fmt:"Carousel · 4 slides",
   img:P+"group-text-memes.png",slides:seq("group",4),canva:"DAHODtsvdCM",
   caption:"Group-chat meme set — friends gassing each other up to just go to opendoor.com."},
  {date:"2026-07-27",title:"What You're Doing vs. Could Be Doing",theme:"meme",fmt:"Static · 3:4",
   img:P+"what-im-doing-beach.png",canva:"DAHN_wrVczk",
   caption:"Selling hassle vs. beach + Opendoor. Emoji comparison — fast, shareable."},
  {date:"2026-07-29",title:"Real Progress — iPhone Photo Grid",theme:"brand",fmt:"Static · 9:16",
   img:P+"real-progress-grid.png",canva:"DAHOCnuVRsg",
   caption:"Story-friendly progress grid. Closes the month on an authentic note."},
  {date:"2026-07-31",title:"Go Together — Summer Edition",theme:"seasonal",fmt:"Static · 3:4",
   img:P+"go-together-summer.png",canva:"DAHN_eXM9GE",
   caption:"Summer 'go together' cap on July, bridging into August."},
  {date:"2026-08-03",title:"Tired Too Sis — Cash Offer to Accept",theme:"meme",fmt:"Static · 3:4",
   img:P+"tired-sis-cash-offer.jpg",canva:"DAHOR5T8W3Y",
   caption:"Viral crosswalk cardboard-sign meme (the 'I'M TIRED TOO SIS' format), sign swapped to 'BUT WE HAVE A FREAKING CASH OFFER TO ACCEPT.' Most template-native of the set — leads the series. Page 1 of the FINAL 4 Canva design.",
   socialCaption:"so much on the to-do list this week 😮‍💨"},
  {date:"2026-08-10",title:"Tired Too Sis — The House Won't Sell Itself",theme:"meme",fmt:"Static · 3:4",
   img:P+"tired-sis-sell-itself.jpg",canva:"DAHOR5T8W3Y",
   caption:"Same format, week 2. Sign: 'BUT THE HOUSE WON'T FREAKING SELL ITSELF' — the social caption delivers the flip. Page 2 of the FINAL 4 design.",
   socialCaption:"actually… it will. opendoor.com"},
  {date:"2026-08-17",title:"Tired Too Sis — That's Why I Sold to Opendoor",theme:"meme",fmt:"Static · 3:4",
   img:P+"tired-sis-sold.jpg",canva:"DAHOR5T8W3Y",
   caption:"Series closer, most ad-like payoff: 'THAT'S WHY I SOLD MY HOUSE TO OPENDOOR.' Runs after the format has done its organic work. Page 3 of the FINAL 4 design.",
   socialCaption:"she gets it 🤝"},
  {date:"2026-08-24",title:"Go Together — Back to School",theme:"seasonal",fmt:"Static · 3:4",
   img:P+"go-together-school.png",canva:"DAHN_QCvB9g",
   caption:"AUGUST teaser — slot to your late-Aug back-to-school cadence."},
];

/* Inventory — ready assets NOT scheduled */
const INVENTORY=[
  {title:"Opendoor Walk Sign — Night (Chicago + Philly)",theme:"brand",fmt:"Carousel · 2 slides",
   img:P+"inv/walksign-chicago.jpg",slides:[P+"inv/walksign-chicago.jpg",P+"inv/walksign-philly.jpg"],canva:"DAHOMAi1t58",
   caption:"Photoreal pedestrian walk signal reskinned Opendoor blue: the don't-walk hand sits unlit while the O glows white — the signal says GO. Chicago (L train) + Philadelphia (City Hall) night scenes. Suggested slot: an open early-August date."},
  {title:"Make It Better — ChatGPT For-Sale Sign",theme:"meme",fmt:"Static · 3:4",img:P+"make-it-better.png",canva:"DAHORyYGTMo",
   caption:"Reskin of the viral 'text ChatGPT a photo + Make it better.' format. A dull, generic For Sale sign gets texted in; ChatGPT replies 'Done.' with a vivid Opendoor sign in the same shot. Real ChatGPT-app chrome (hamburger + ChatGPT header, compose/more icons), rendered as crisp HTML, not a screenshot."},
  {title:"Tired Too Sis — 27 Showings (alternate)",theme:"meme",fmt:"Static · 3:4",img:P+"tired-sis-showings.jpg",canva:"DAHOR5T8W3Y",
   caption:"Fourth variant of the cardboard-sign series: 'BUT WE ARE NOT DOING 27 SHOWINGS THIS WEEKEND.' A/B alternate or a 4th weekly beat if the format performs. Page 4 of the FINAL 4 design (all 6 raw variants: DAHOLnIoyZg)."},
  {title:"Doctor's Rx — Handwritten Scribble",theme:"meme",fmt:"Static · 4:5",img:P+"inv/doctor-scribble.png",canva:"DAHN_wWzGLo",
   caption:"Alternate hand-scribble style of the Doctor's Rx meme (different look from the scheduled iPhone version) — good A/B option."},
  {title:"What You're Doing — Variant 2",theme:"meme",fmt:"Static · 4:5",img:P+"inv/what-v2.png",canva:"DAHN_7Mo14s",
   caption:"A/B variant of the beach 'what you could be doing' comparison."},
  {title:"What You're Doing — Variant 3",theme:"meme",fmt:"Static · 4:5",img:P+"inv/what-v3.png",canva:"DAHN_yjMIYg",
   caption:"Third A/B variant of the beach comparison."},
  {title:"Opendoor in the Clouds — City Skylines",theme:"brand",fmt:"Carousel · 3 slides · 7 cities",
   img:P+"inv/untitled-omp.png",slides:[P+"inv/untitled-omp.png",P+"inv/untitled-d5oi.png",P+"inv/untitled-gu5.png"],canva:"DAHN9oMp1t0",
   caption:"Sky-pano + cloud-wordmark carousel. 7 city variants built (Seattle, Chicago, Las Vegas shown). Reusable city series. Link opens the Seattle build."},
  {title:"Opendoor in the Clouds — Plain (template)",theme:"brand",fmt:"Carousel · 3 slides",
   img:P+"inv/plain-sky-slide1.png",slides:[P+"inv/plain-sky-slide1.png",P+"inv/plain-sky-slide2.png",P+"inv/plain-sky-slide3.png"],canva:"DAHN8PgFU8k",
   caption:"No-city sky-pano + cloud-wordmark carousel — the base template every city variant is copied from. Works as a plain evergreen brand post."},
  {title:"The Showing — Paper-Collage Narrative",theme:"brand",fmt:"Video · 9:16 · ~42s",img:P+"inv/the-showing.jpg",video:"~/opendoor/finals/the-showing/the_showing_papercollage_v3_VO.mp4",
   caption:"Emotional Pixar-style narrative spot rendered as hand-torn cut-paper, with VO."},
  {title:"Good Dogs — Clay Stop-Motion",theme:"brand",fmt:"Video · 9:16 · 15s",img:P+"inv/good-dogs.jpg",video:"~/opendoor/finals/good-dogs/good-dogs-clips/gooddogs_15s_scored.mp4",
   caption:"Claymation 'the move, via the dogs'. Scored 15s cut."},
  {title:"Cash Now, More Later — UI Motion",theme:"proof",fmt:"Video · 9:16",img:P+"inv/cashnow.jpg",video:"~/opendoor/finals/cashnow/opendoor_cashnow_final_vertical.mp4",
   caption:"Two-phase NOW/LATER UI-motion explainer; choreographed zoom-through intro."},
  {title:"My Friend vs. Me — Comparison",theme:"meme",fmt:"Video · 9:16",img:P+"inv/friend-vs-me.jpg",video:"~/opendoor/finals/friend-vs-me/opendoor_vs_guys.mp4",
   caption:"Stress-vs-calm two-column comparison meme, kinetic text, no VO."},
  {title:"POV Phone Walk — App Demo",theme:"brand",fmt:"Video · 9:16",img:P+"inv/phone-walk.jpg",video:"~/opendoor/finals/phone-walk/opendoor_phone_walk.mp4",
   caption:"POV phone-in-hand get-an-offer walkthrough → $534,200, on a real walking plate."},
  {title:"Whiteboard Teach — Comparison UGC",theme:"meme",fmt:"Video · 9:16",img:P+"inv/whiteboard.jpg",video:"~/opendoor/finals/whiteboard/opendoor_whiteboard_teach_v5.mp4",
   caption:"Presenter + 'SELL THE OLD WAY → YOU NEED' board, $427k phone payoff."},
  {title:"The Other Door — Unaware Ad",theme:"brand",fmt:"Video · 9:16 · 50s",img:P+"inv/unaware.jpg",video:"~/opendoor/finals/unaware/opendoor_unaware_captioned.mp4",
   caption:"Trapped-equity spot, flat delivery, music holds until the reveal. Captioned cut."},
  {title:"Review Wall — Social Proof",theme:"proof",fmt:"Video · 9:16 · 30s",img:P+"inv/review-wall.jpg",video:"~/opendoor/finals/review-wall/seller_reviewwall_30s_v1.mp4",
   caption:"Fast-flip wall of real reviews; featured cards snap & hold. 30s + 15s cuts."},
  {title:"Skip to SOLD — Panorama Fly-Through",theme:"meme",fmt:"Video · 9:16",img:P+"inv/sold.jpg",video:"~/opendoor/finals/sold/opendoor_sold_flythrough.mp4",
   caption:"Snaking-word 'SOOOLLLDDD' panorama fly-through."},
  {title:"Kicks to Offer — Giant Phone in a Field",theme:"brand",fmt:"Video · 9:16",img:P+"inv/kicks-offer.jpg",video:"~/opendoor/finals/kicks-offer/opendoor_kicks_offer_picturelock.mp4",
   caption:"Soccer kicks wake the phone → photograph house → offer in hand → SOLD. Also a strong World Cup tie-in."},
  {title:"Offer-Confidence Slate — Pixar Spots",theme:"brand",fmt:"Video · 9:16 · 4 cities",img:P+"inv/offer-confidence.jpg",video:"~/opendoor/finals/offer-confidence/offer-confidence-previews/phoenix-jennifer_preview.mp4",
   caption:"4 Pixar Opendoor spots (Phoenix / Atlanta / Raleigh / Denver), VO + captions + music."},
  {title:"Green-Guy Reaction — Greenscreen Stitch",theme:"meme",fmt:"Video · 9:16",img:P+"inv/greenguy.jpg",video:"~/opendoor/finals/greenguy/opendoor_greenguy_reaction.mp4",
   caption:"Green-morphsuit guy invades a house; lady reacts: 'deal with this or sell to Opendoor.'"},
  {title:"UGC Talking-Head Spots",theme:"brand",fmt:"Video · 9:16",img:P+"inv/ugc-spots.jpg",video:"~/opendoor/finals/ugc-spots/opendoor_ugc_FINAL_notext.mp4",
   caption:"Native UGC talking-head set (comments / relocation variants), no burned-in text."},
  {title:"Skip to SOLD — Copy Machine Reveal",theme:"meme",fmt:"Static · 3:4",img:P+"copy-machine-receipt.png",canva:"DAHOLyzi2LA",
   caption:"'Home Sale Receipt' prints out of a copier, Total: SOLD. Built from a Canva Content Reveal template — Canva-only build, no local render."},
  {title:"Seasons Split — Dallas Ranch",theme:"seasonal",fmt:"Video · 9:16 · ~10s",img:P+"inv/seasons-split-dallas.jpg",video:"~/opendoor/finals/seasons-split-dallas/seasons_dallas.mp4",
   caption:"Hard-cut geometric-mask reskin: a $650k Dallas ranch flips summer↔autumn mid-frame. Textless cut also available."},
  {title:"What's It Worth — TOFU Curiosity Spot",theme:"brand",fmt:"Video · 9:16 · ~33s",img:P+"inv/whats-it-worth.jpg",video:"~/opendoor/projects/whats-it-worth/output/worth_preview.mp4",
   caption:"Top-of-funnel Pixar spot built around home-value curiosity, soft 'see your value' CTA. Silent picture-lock."},
  {title:"The Situation — Inherited Home",theme:"brand",fmt:"Video · 9:16 · ~42s",img:P+"inv/inherited.jpg",video:"~/opendoor/projects/the-situation-inherited/output/inherited_preview.mp4",
   caption:"Warm Pixar narrative about selling a home you've inherited. Silent picture-lock. (Distinct from the shorter UGC 'inherited' cutdown in the UGC Talking-Head set.)"},
  {title:"Jennifer Chen — The Overlap (\"Both\")",theme:"brand",fmt:"Video · 9:16 · ~46s",img:P+"inv/jennifer-both.jpg",video:"~/opendoor/finals/jennifer-both/pixar-both-clips/jennifer_both_pixar_FINAL_silent.mp4",
   caption:"Pragmatic-planner persona juggling life's overlap; Pixar cut shown. A claymation alt cut also exists (~37s, minor dog-morph glitch in shot 08 per QA notes). Silent picture-lock. Not the same asset as the Phoenix-Jennifer spot in Offer-Confidence Slate."},
  {title:"Dream Home Mug — Steam Reveal",theme:"brand",fmt:"Video · 9:16",img:P+"inv/dream-home-mug.jpg",video:"~/opendoor/finals/dream-home-mug/dream_home_mug_omniflash_v2_steam.mp4",
   caption:"Steam rising from a coffee mug forms a tiny house silhouette. v2 'steam' take — the improved version."},
  {title:"Move-In Found Footage",theme:"brand",fmt:"Video · 4:3 · ~9s",img:P+"inv/movein-homevideo.jpg",video:"~/opendoor/finals/movein-homevideo/movein_natural_foundfootage_v2.mp4",
   caption:"Faux 2010s camcorder found-footage: dad clumsily films his family moving into their first house. Intentional 4:3 camcorder look."},
  {title:"Jersey Crest Reveal — Alternate Styles",theme:"brand",fmt:"Video · 9:16 · 4 styles",img:P+"inv/jersey-crest-alt.jpg",video:"~/opendoor/projects/jersey-patch-embroidery/omni_out/crest_modern_minimal_take1.mp4",
   caption:"Macro embroidery timelapse, an Opendoor crest self-stitching onto a jersey. Modern-minimal shown; shield-banner, shield-classic, and shield-classic-whiteO cuts also finished. (Circular-ring cut is already scheduled Jul 19.)"},
];

/* ===== STATE ===== */
let posts=load();
let view="month", viewY=2026, viewM=6;
let pendingExtra=null;          // slides/file carried into Add from inventory
let pendingCanvaImports=[];
let lbItem=null, lbIdx=0, lbSlides=[];
const INV_HIDDEN_KEY="opendoor_inv_hidden_v2";   // hidden inventory ids
const INV_CUSTOM_KEY="opendoor_inv_custom_v1";   // user-added inventory items
let invHidden=loadHidden(), customInv=loadCustom();
let modalMode="post";                            // "post" | "inv"
function loadHidden(){return new Set(storage.getJSON(INV_HIDDEN_KEY,[]));}
function saveHidden(){storage.setJSON(INV_HIDDEN_KEY,[...invHidden]);}
function loadCustom(){return storage.getJSON(INV_CUSTOM_KEY,[]);}
function saveCustom(){storage.setJSON(INV_CUSTOM_KEY,customInv);}
function slug(s){return (s||"item").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");}
// unified inventory: built-in catalog (stable ids) + user-added customs
function allInv(){return [...INVENTORY.map(it=>({id:"inv-"+slug(it.title),builtin:true,...it})), ...customInv];}
// "new inventory" notification — track which item ids have been seen
const INV_SEEN_KEY="opendoor_inv_seen_v1";
let invSeen=loadSeen();
function loadSeen(){const raw=storage.getJSON(INV_SEEN_KEY,null);
  if(raw)return new Set(raw);
  const s=new Set(INVENTORY.map(it=>"inv-"+slug(it.title)));  // first run: existing catalog isn't "new"
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
function commentKey(id){return id||(lbItem&&lbItem.id?"inv-"+lbItem.id:"");}
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
    '<span class="del" data-action="delete-comment" data-comment-id="'+c.id+'">Delete</span></div>'+
    '<div class="text">'+esc(c.text)+'</div></div></div>'
  ).join("");
}

/* ===== CANVA CAPTION PUSH ===== */
const CANVA_API="https://api.canva.com/v1";
function getCanvaToken(){return storage.get(CANVA_TOKEN_KEY);}
function getCanvaCaptionField(){return storage.get(CANVA_CAPTION_FIELD_KEY,"caption").trim()||"caption";}
function saveCanvaCaptionField(){storage.set(CANVA_CAPTION_FIELD_KEY,document.getElementById("f-canvaCaptionField").value.trim()||"caption");}
function getCanvaTemplateId(p){if(!p||!p.canva)return null;const c=p.canva.trim();return c.startsWith("http")?(c.match(/template_id=([^&]+)/)?.[1]||c.match(/\/templates\/([^/?]+)/)?.[1]||c.match(/\/design\/([^/]+)/)?.[1]):c;}
function showCanvaStatus(msg,ok){const el=document.getElementById("canvaStatus");if(!el)return;el.textContent=msg;el.className="canva-status"+(ok===true?" ok":ok===false?" err":"");}
function toggleCanvaPushRow(){const row=document.getElementById("canvaPushRow");const canva=document.getElementById("f-canva").value.trim();const sc=document.getElementById("f-socialCaption").value.trim();row.style.display=(canva&&sc)?"flex":"none";if(!sc)showCanvaStatus("","");}
async function pushCaptionToCanva(){
  const sc=document.getElementById("f-socialCaption").value.trim();if(!sc){showCanvaStatus("Write a social caption first.",false);return;}
  const canvaId=document.getElementById("f-canva").value.trim();if(!canvaId){showCanvaStatus("Link a Canva design first.",false);return;}
  const brandTemplateId=getCanvaTemplateId({canva:canvaId});
  if(!brandTemplateId){showCanvaStatus("Could not read a Canva template ID from that value.",false);return;}
  let tok=getCanvaToken();
  if(!tok){tok=prompt("Paste your Canva Connect API token (stored only in this browser):");if(!tok)return;tok=tok.trim();storage.set(CANVA_TOKEN_KEY,tok);}
  const captionField=getCanvaCaptionField();
  const data={};data[captionField]={type:"text",text:sc};
  showCanvaStatus("Pushing to Canva…","");
  try{
    const res=await fetch(CANVA_API+"/autofills",{method:"POST",
      headers:{Authorization:"Bearer "+tok,"Content-Type":"application/json"},
      body:JSON.stringify({brand_template_id:brandTemplateId,data})});
    if(res.ok){
      const data=await res.json();
      showCanvaStatus("Autofill started ✓ Check Canva for the generated design.",true);
    } else if(res.status===401||res.status===403){
      storage.remove(CANVA_TOKEN_KEY);
      const er=await res.json().catch(()=>({}));
      showCanvaStatus("Auth failed: "+(er.message||"token rejected")+". Click again to re-enter.",false);
    } else {
      const er=await res.json().catch(()=>({}));
      showCanvaStatus("Push failed: "+(er.message||res.status)+". Confirm template field: "+captionField,false);
    }
  }catch(e){showCanvaStatus("Network error: "+e.message,false);}
}
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
  box.innerHTML='<table class="import-table"><thead><tr><th>Destination</th><th>Title</th><th>Theme</th><th>Date</th><th>Canva</th><th>Social caption</th></tr></thead><tbody>'+pendingCanvaImports.map(item=>{
    const dest=destination==="schedule"&&item.targetDate?"Schedule":"Inventory";
    return '<tr><td>'+dest+'</td><td>'+esc(item.title)+'</td><td>'+esc((THEME[item.theme]||THEME.brand).label)+'</td><td class="muted">'+esc(item.targetDate||"—")+'</td><td class="muted">'+esc(extractCanvaId(item.canva)||"")+'</td><td class="muted">'+esc(item.socialCaption||"—")+'</td></tr>';
  }).join("")+'</tbody></table>';
}
function saveCanvaImports(){
  if(!pendingCanvaImports.length)parseCanvaImports();
  if(!pendingCanvaImports.length)return;
  const destination=document.getElementById("canvaImportDestination").value;
  let addedPosts=0,addedInv=0;
  pendingCanvaImports.forEach(item=>{
    const {targetDate,source,...base}=item;
    if(destination==="schedule"&&targetDate){posts.push({id:uid(),date:targetDate,holiday:"",...base});addedPosts++;}
    else{customInv.push({id:uid(),...base});addedInv++;}
  });
  saveCustom();storage.setJSON(STORE_KEY,posts);closeCanvaImport();setView(addedPosts?"month":"inv");render();
  toast("Imported "+(addedPosts?addedPosts+" scheduled":"")+(addedPosts&&addedInv?" + ":"")+(addedInv?addedInv+" inventory":"")+" item"+((addedPosts+addedInv)===1?"":"s"));
}

function buildPayload(){return {version:6,exportedAt:new Date().toISOString(),posts,customInventory:customInv,hiddenInventory:[...invHidden],comments};}
function rememberSync(d){if(d&&d.exportedAt)storage.set(LAST_SYNC_KEY,d.exportedAt);}
function applyPayload(d){
  if(Array.isArray(d)){posts=d.map(p=>({id:p.id||uid(),...p}));storage.setJSON(STORE_KEY,posts);return true;}
  if(!d||!Array.isArray(d.posts))return false;
  posts=d.posts.map(p=>({id:p.id||uid(),...p}));
  customInv=(d.customInventory||[]).map(it=>({id:it.id||uid(),...it}));saveCustom();
  invHidden=new Set(d.hiddenInventory||[]);saveHidden();
  comments=d.comments||{};saveComments();rememberSync(d);
  storage.setJSON(STORE_KEY,posts);return true;
}
function cleanupComments(){
  const valid=new Set(posts.map(p=>p.id));allInv().forEach(it=>valid.add("inv-"+it.id));
  let changed=false;Object.keys(comments).forEach(k=>{if(!valid.has(k)){delete comments[k];changed=true;}});
  if(changed)saveComments();
}

function load(){
  let arr;
  arr=storage.getJSON(STORE_KEY,null)||seed();
  // backfill slides/file from DEFAULTS for previously-saved posts (match by canva id)
  arr.forEach(p=>{
    if(p.canva && (!p.slides||!p.slides.length)){const d=DEFAULTS.find(x=>x.canva===p.canva); if(d&&d.slides)p.slides=d.slides;}
  });
  return arr;
}
function seed(){return DEFAULTS.map((p,i)=>({id:"seed-"+i,...p}));}
function save(){storage.setJSON(STORE_KEY,posts);render();}
function uid(){return "p-"+Date.now().toString(36)+Math.floor(Math.random()*1e4).toString(36);}
function canvaURL(c){return !c?null:(c.startsWith("http")?c:"https://www.canva.com/design/"+c+"/view");}
function fileURL(v){return !v?null:(/^https?:\/\//i.test(v)?v:"file://"+v.replace(/^~/,"/Users/morganbrown"));}
function parse(d){const a=d.split("-").map(Number);return new Date(a[0],a[1]-1,a[2]);}
function fmtFull(d){const dt=parse(d);return DOW[dt.getDay()]+", "+MON3[dt.getMonth()]+" "+dt.getDate();}
function esc(s){return (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");}
function slidesOf(p){return (p.slides&&p.slides.length)?p.slides:(p.img?[p.img]:[]);}
function isVideo(p){return !!p.video;}

/* ===== STATS ===== */
function stats(){
  document.getElementById("s-posts").textContent=posts.length;
  const vis=allInv().filter(it=>!invHidden.has(it.id)).length, nw=newInvCount();
  document.getElementById("btn-inv").innerHTML="Unscheduled ("+vis+")"+(nw?'<span class="newdot" title="'+nw+' new">'+nw+'</span>':'');
  if(!posts.length){document.getElementById("s-range").textContent="—";return;}
  const s=[...posts].sort((a,b)=>a.date.localeCompare(b.date));
  const a=parse(s[0].date),b=parse(s[s.length-1].date);
  document.getElementById("s-range").textContent=MON3[a.getMonth()]+" "+a.getDate()+" – "+MON3[b.getMonth()]+" "+b.getDate();
}
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
    const m=MARKERS[ds]; if(m)inner+='<div class="marker mk-'+m.t+'">'+m.l+'</div>';
    posts.filter(p=>p.date===ds).forEach(p=>{
      const t=THEME[p.theme]||THEME.meme;
      const cc=comments[p.id]?comments[p.id].length:0;
      inner+='<div class="chip" draggable="true" data-id="'+p.id+'" data-action="open-preview" style="border-left-color:'+t.color+'">'+
             '<img src="'+(p.img||"")+'" alt="">'+
             '<span class="ct">'+(isVideo(p)?'▶ ':'')+esc(p.title)+'</span>'+
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
      if(p&&p.date!==cell.dataset.date){p.date=cell.dataset.date;save();}});
  });
}

/* ===== LIST ===== */
function weekStart(d){const dt=parse(d);dt.setDate(dt.getDate()-dt.getDay());return dt;}
function postCard(p){
  const t=THEME[p.theme]||THEME.meme;
  const when=p.holiday?'<div class="when" style="background:'+t.color+'">'+fmtFull(p.date)+' · '+esc(p.holiday)+'</div>':'<div class="when">'+fmtFull(p.date)+'</div>';
  return '<div class="card" data-action="open-preview" data-id="'+p.id+'"><div class="thumb">'+when+
    '<div class="tags">'+(isVideo(p)?'<span class="vbadge">▶ VIDEO</span>':'')+'</div>'+
    '<img src="'+(p.img||"")+'" alt="" loading="lazy">'+
    (isVideo(p)?'<div class="play"><span></span></div>':'')+'</div>'+
    '<div class="cbody"><div class="ctop"><span class="badge '+t.cls+'">'+t.label+'</span><span class="fmt">'+esc(p.fmt||"")+'</span></div>'+
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
    return '<div class="card"><div class="thumb" data-action="open-preview-inv" data-id="'+it.id+'">'+
      '<button class="inv-del" title="Remove from inventory" data-action="delete-inv" data-id="'+it.id+'">×</button>'+
      '<div class="tags">'+(it.builtin?"":'<span class="vbadge" style="background:rgba(31,128,255,.92)">ADDED</span>')+(it.video?'<span class="vbadge">▶ VIDEO</span>':'')+'</div>'+
      '<img src="'+(it.img||"")+'" alt="" loading="lazy">'+
      (it.video?'<div class="play"><span></span></div>':'')+
      (done?'<span class="sched-pill">✓ Scheduled</span>':'')+'</div>'+
      '<div class="cbody"><div class="ctop"><span class="badge '+t.cls+'">'+t.label+'</span><span class="fmt">'+esc(it.fmt||"")+'</span></div>'+
      '<div class="ctitle">'+esc(it.title)+'</div><div class="caption">'+esc(it.caption||"")+'</div>'+
      '<button class="cta" data-action="add-from-inv" data-id="'+it.id+'">'+(done?'Add again →':'Add to schedule →')+'</button></div></div>';
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
  if(item.canva)acts.push('<a class="canva" target="_blank" href="'+canvaURL(item.canva)+'">Open in Canva ↗</a>');
  if(item.video)acts.push('<a target="_blank" href="'+fileURL(item.video)+'">▶ Open video file</a>');
  if(item.file)acts.push('<a target="_blank" href="'+fileURL(item.file)+'">Open file ↗</a>');
  if(id)acts.push('<button data-action="edit-post" data-id="'+id+'">Edit details</button>');
  else {acts.push('<button data-action="add-from-lb-inv">Add to schedule →</button>');
        if(item.builtin===false)acts.push('<button data-action="edit-inv" data-id="'+item.id+'">Edit item</button>');}
  document.getElementById("lbActs").innerHTML=acts.join("");
  renderComments(commentKey(id));
  renderLBMedia();
  document.getElementById("lb").classList.add("open");
}
function renderLBMedia(){
  const m=document.getElementById("lbMedia");
  if(isVideo(lbItem)){
    m.innerHTML='<video controls autoplay playsinline src="'+fileURL(lbItem.video)+'" poster="'+(lbItem.img||"")+'"></video>';
    document.getElementById("lbPrev").style.visibility="hidden"; document.getElementById("lbNext").style.visibility="hidden";
    document.getElementById("lbCounter").textContent="";
  } else {
    m.innerHTML='<img src="'+(lbSlides[lbIdx]||lbItem.img||"")+'" alt="">';
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
  f("fmt",p.fmt||"");f("holiday",p.holiday||"");f("caption",p.caption||"");f("socialCaption",p.socialCaption||"");f("canva",p.canva||"");
  f("canvaCaptionField",getCanvaCaptionField());
  f("video",p.video||p.file||"");f("img",p.img||"");syncPrev();
  showCanvaStatus("","");toggleCanvaPushRow();
}
function f(id,val){document.getElementById("f-"+id).value=val;}
function syncPrev(){const i=document.getElementById("f-prevImg");i.src=document.getElementById("f-img").value;i.style.visibility="visible";}
function uploadPrev(e){const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=()=>{document.getElementById("f-img").value=r.result;syncPrev();};r.readAsDataURL(file);}
function closeModal(){document.getElementById("overlay").classList.remove("open");}
function savePost(){
  const title=document.getElementById("f-title").value.trim();
  if(!title){alert("Title is required.");return;}
  const vid=document.getElementById("f-video").value.trim();
  const base={title,theme:document.getElementById("f-theme").value,fmt:document.getElementById("f-fmt").value.trim(),
    caption:document.getElementById("f-caption").value.trim(),socialCaption:document.getElementById("f-socialCaption").value.trim(),
    canva:document.getElementById("f-canva").value.trim(),
    img:document.getElementById("f-img").value.trim()};
  // treat .mp4/.mov/.webm as a playable video, anything else as a generic file link
  if(/\.(mp4|mov|webm|m4v)$/i.test(vid)){base.video=vid;} else if(vid){base.file=vid;}
  const id=document.getElementById("f-id").value;
  if(modalMode==="inv"){                       // create/update a custom inventory item
    const existing=id?customInv.find(x=>x.id===id):null;
    if(existing)Object.assign(existing,base); else customInv.push({id:uid(),...base});
    saveCustom();closeModal();setView('inv');render();return;
  }
  const date=document.getElementById("f-date").value;
  if(!date){alert("Date is required.");return;}
  const fields={...base,date,holiday:document.getElementById("f-holiday").value.trim()};
  if(id){Object.assign(posts.find(x=>x.id===id),fields);}
  else{const np={id:uid(),...fields};if(pendingExtra){if(pendingExtra.slides)np.slides=pendingExtra.slides;if(pendingExtra.file)np.file=pendingExtra.file;}
       posts.push(np);const dt=parse(date);viewY=dt.getFullYear();viewM=dt.getMonth();}
  pendingExtra=null;closeModal();save();
}
function deletePost(){const id=document.getElementById("f-id").value;
  if(modalMode==="inv"){if(id&&confirm("Delete this inventory item?")){customInv=customInv.filter(x=>x.id!==id);saveCustom();closeModal();setView('inv');render();}return;}
  if(id&&confirm("Delete this post?")){posts=posts.filter(x=>x.id!==id);delete comments[id];saveComments();closeModal();save();}}
function addFromInvId(id){const it=findInv(id);if(it){setView('month');openAdd(it);}}
function addFromInvItem(){openAdd(lbItem);}

/* ===== VIEW / EXPORT ===== */
function render(){stats();buildGrid();buildList();buildInv();}
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
function goToday(){viewY=2026;viewM=6;buildGrid();}
function exportJSON(){
  cleanupComments();
  const payload=buildPayload();
  const b=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="opendoor-content-calendar.json";a.click();
}
function importJSON(e){const file=e.target.files[0];if(!file)return;const r=new FileReader();
  r.onload=()=>{try{const d=JSON.parse(r.result);
    if(!applyPayload(d)){alert("Invalid file.");return;}
    cleanupComments();render();
  }catch(x){alert("Could not parse JSON.");}};
  r.readAsText(file);e.target.value="";}
function resetAll(){if(confirm("Reset to the original seeded schedule? Discards your changes.")){posts=seed();comments={};saveComments();save();}}

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
    "shift-month":()=>shiftMonth(step),"go-today":()=>goToday(),"add-inventory":()=>addInventory(),"push-caption-canva":()=>pushCaptionToCanva(),
    "copy-social-caption":()=>copySocialCaption(),"delete-post":()=>deletePost(),"close-modal":()=>closeModal(),"save-post":()=>savePost(),
    "close-lb":()=>closeLB(),"lb-step":()=>lbStep(step),"add-comment":()=>addComment(),"delete-comment":()=>deleteComment(el.dataset.commentId),
    "open-preview":()=>openPreview(id),"open-preview-inv":()=>openPreviewInv(id),"delete-inv":()=>deleteInv(id),"add-from-inv":()=>addFromInvId(id),
    "restore-inv":()=>restoreInv(),"edit-post":()=>{closeLB();openEdit(id);},"add-from-lb-inv":()=>{closeLB();addFromInvItem();},
    "edit-inv":()=>{closeLB();editInvItem(id);}
  };
  if(actions[action])actions[action]();
}

function handleInput(e){
  if(e.target.id==="f-socialCaption"||e.target.id==="f-canva")toggleCanvaPushRow();
  if(e.target.id==="f-canvaCaptionField")saveCanvaCaptionField();
  if(e.target.id==="f-img")syncPrev();
  if(e.target.id==="canvaImportDestination"&&pendingCanvaImports.length)renderCanvaImportPreview();
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
const REPO={owner:"morganb180",repo:"opendoor-content-calendar",branch:"main",path:"calendar-data.json"};
function applyState(d){
  return applyPayload(d);}
async function pullFromRepo(silent){
  try{const res=await fetch(REPO.path+"?t="+(+new Date()),{cache:"no-store"});if(!res.ok)throw 0;
    const d=await res.json();if(applyState(d)){cleanupComments();render();if(!silent)toast("Pulled latest from GitHub ✓");}}
  catch(e){if(!silent)toast("No shared data found yet — Sync ↑ first.");}}
async function pushToRepo(){
  let tok=storage.get(GH_TOKEN_KEY);
  if(!tok){tok=prompt("Paste a GitHub token (fine-grained PAT with Contents: Read+Write on "+REPO.repo+").\nStored only in this browser, never in the page.");
    if(!tok)return;tok=tok.trim();storage.set(GH_TOKEN_KEY,tok);}
  const api="https://api.github.com/repos/"+REPO.owner+"/"+REPO.repo+"/contents/"+REPO.path;
  cleanupComments();
  const payload=buildPayload();
  const content=btoa(unescape(encodeURIComponent(JSON.stringify(payload,null,2))));
  const H={Authorization:"Bearer "+tok,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"};
  toast("Pushing to GitHub…");
  try{let sha;const g=await fetch(api+"?ref="+REPO.branch,{headers:H});if(g.ok){const remote=await g.json();sha=remote.sha;
      if(remote.content){const remotePayload=JSON.parse(decodeURIComponent(escape(atob(remote.content.replace(/\n/g,"")))));const last=storage.get(LAST_SYNC_KEY);
        if(remotePayload.exportedAt&&last&&remotePayload.exportedAt!==last&&!confirm("GitHub has newer shared data than your last pull. Push anyway and overwrite it?"))return;}};
    const put=await fetch(api,{method:"PUT",headers:H,body:JSON.stringify({message:"Update calendar "+new Date().toISOString(),content,branch:REPO.branch,sha})});
    if(put.ok){rememberSync(payload);toast("Pushed to GitHub ✓ Other machines: Sync ↓");}
    else{const er=await put.json().catch(()=>({}));if(put.status===401||put.status===403){storage.remove(GH_TOKEN_KEY);}toast("Push failed: "+(er.message||put.status));}}
  catch(e){toast("Push error: "+e.message);}}

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
  if(!storage.get(STORE_KEY)) await pullFromRepo(true);   // fresh machine -> grab shared state
  render();
  document.getElementById("foot").innerHTML=
    "<b>Preview:</b> click any post (or inventory item) to open it full-size — carousels are swipeable (‹ ›/arrow keys), videos play inline. "+
    "<b>Schedule:</b> drag posts between days; click → <b>Edit details</b>. <b>+ Add post</b> / <b>+ Add inventory item</b> for new content; use ‹ › for future months. "+
    "<br><b>Sync across machines:</b> <b>Sync ↑</b> pushes your schedule to GitHub (asks once for a token, stored only in this browser); <b>Sync ↓</b> on another machine pulls the latest. A fresh machine auto-pulls on first open. "+
    "<b>Export/Import</b> JSON also works for manual backup. "+
    "<br><b>Holidays/events</b> show as colored tags and update as you navigate months. Canva posts open <code>canva.com/design/&lt;id&gt;/view</code>. "+
    "<b>Social captions:</b> add the actual IG/FB caption in the edit form. If the post has a Canva Autofill template, <b>Push to Canva Autofill</b> sends it via the Canva Connect API (token stored in browser). "+
    "<b>Comments:</b> leave internal feedback on any post or inventory item in the preview panel — comments sync with Sync ↑/↓. "+
    "<i>Note: videos link to local files and won't play on the hosted site; image previews &amp; carousels do.</i>";
}
// gate startup
if(storage.get("cal_gate_ok")===GATE_HASH){document.getElementById("gate").style.display="none";initApp();}
else{document.getElementById("gate").style.display="grid";document.getElementById("gatePass").focus();}
