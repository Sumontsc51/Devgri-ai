/* Finalized AI app builder — markup + styles (ported from ai-app-builder.html).
   Rendered via dangerouslySetInnerHTML; logic lives in engine.ts. */

export const BUILDER_CSS = `
#builder-root{
  --surface-0:#f2f0ea; --surface-1:#f7f6f3; --surface-2:#ffffff;
  --border:#e3e1da; --border-strong:#c9c7bf;
  --text-primary:#1f1e1b; --text-secondary:#6b6a64; --text-muted:#96948c;
  --text-accent:#4f46b8; --bg-accent:#eeedfe; --border-accent:#afa9ec; --fill-accent:#534ab7;
  --text-danger:#a32d2d; --bg-danger:#fcebeb; --border-danger:#f09595;
  --edge:#b4b2a9; --conn:#7f77dd; --shadow:0 1px 3px rgba(0,0,0,.08);
}
@media (prefers-color-scheme: dark){
  #builder-root{
    --surface-0:#161616; --surface-1:#1d1d1c; --surface-2:#262625;
    --border:#3a3936; --border-strong:#55534e;
    --text-primary:#ececea; --text-secondary:#a5a39c; --text-muted:#77756e;
    --text-accent:#afa9ec; --bg-accent:#2e2a54; --border-accent:#534ab7; --fill-accent:#534ab7;
    --text-danger:#f09595; --bg-danger:#3d1c1c; --border-danger:#791f1f;
    --edge:#5f5e5a; --conn:#7f77dd; --shadow:0 1px 3px rgba(0,0,0,.4);
  }
}
#builder-root{margin:0;box-sizing:border-box;font-family:-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:var(--surface-0);color:var(--text-primary);height:100vh;overflow:hidden;display:block;}
#builder-root *{margin:0;box-sizing:border-box;}
#builder-root button{font-family:inherit;font-size:13px;color:var(--text-primary);background:transparent;border:none;border-radius:7px;padding:6px 10px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;}
#builder-root button:hover{background:var(--border);}
#builder-root button.primary{background:var(--fill-accent);color:#fff;padding:8px 16px;font-weight:500;}
#builder-root button.primary:hover{opacity:.9;}
#builder-root input[type=text],#builder-root input[type=password],#builder-root textarea,#builder-root select{font-family:inherit;font-size:13px;color:var(--text-primary);background:var(--surface-1);border:1px solid var(--border);border-radius:8px;padding:8px 10px;outline:none;resize:none;}
#builder-root input[type=text]:focus,#builder-root input[type=password]:focus,#builder-root textarea:focus{border-color:var(--border-accent);}
#builder-root .seg{display:flex;background:var(--surface-1);border:1px solid var(--border);border-radius:8px;padding:2px;}
#builder-root .seg button{border-radius:6px;font-size:12px;padding:5px 12px;}
#builder-root .seg button.on{background:var(--surface-2);box-shadow:var(--shadow);font-weight:500;}
#start{height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:20px;}
#start .logo{width:52px;height:52px;border-radius:14px;background:var(--bg-accent);display:flex;align-items:center;justify-content:center;color:var(--text-accent);font-size:28px;}
#start h1{font-size:24px;font-weight:600;}
#start p{color:var(--text-secondary);font-size:14px;margin-top:-8px;}
#p0wrap{width:min(640px,92vw);background:var(--surface-2);border:1px solid var(--border);border-radius:14px;padding:12px;box-shadow:var(--shadow);}
#p0{width:100%;border:none;background:transparent;font-size:14px;min-height:64px;padding:4px;}
#p0row{display:flex;justify-content:space-between;align-items:center;margin-top:6px;gap:8px;}
#p0key{font-size:11px;color:var(--text-muted);}
#p0key b{color:var(--text-accent);cursor:pointer;}
.chips{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;max-width:640px;}
.chips button{font-size:12px;border:1px solid var(--border);background:var(--surface-2);border-radius:16px;padding:6px 12px;color:var(--text-secondary);}
.chips button:hover{border-color:var(--border-accent);color:var(--text-accent);background:var(--bg-accent);}
#build{display:none;height:100vh;flex-direction:column;}
#topbar{display:flex;align-items:center;gap:10px;padding:8px 14px;background:var(--surface-2);border-bottom:1px solid var(--border);}
#pname{font-size:14px;font-weight:600;display:flex;align-items:center;gap:8px;}
#body{flex:1;display:flex;min-height:0;}
#chat{width:320px;min-width:260px;background:var(--surface-2);border-right:1px solid var(--border);display:flex;flex-direction:column;}
#msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;}
.msg{max-width:92%;font-size:13px;line-height:1.55;padding:9px 12px;border-radius:12px;white-space:pre-wrap;}
.msg.user{align-self:flex-end;background:var(--bg-accent);color:var(--text-accent);border-bottom-right-radius:4px;}
.msg.ai{align-self:flex-start;background:var(--surface-1);border:1px solid var(--border);border-bottom-left-radius:4px;}
.msg.ai b{font-weight:600;}
.dots span{display:inline-block;width:5px;height:5px;border-radius:50%;background:var(--text-muted);margin:0 1.5px;animation:bl 1s infinite;}
.dots span:nth-child(2){animation-delay:.2s}.dots span:nth-child(3){animation-delay:.4s}
@keyframes bl{0%,80%,100%{opacity:.3}40%{opacity:1}}
#chipwrap{padding:0 12px;}
#selchip{display:none;align-items:center;gap:6px;font-size:12px;background:var(--bg-accent);color:var(--text-accent);border-radius:8px;padding:5px 10px;margin-bottom:6px;}
#selchip .x{cursor:pointer;margin-left:auto;font-size:13px;}
#inrow{display:flex;gap:8px;padding:10px 12px 12px;border-top:1px solid var(--border);}
#pin{flex:1;min-height:38px;max-height:110px;}
#main{flex:1;position:relative;min-width:0;display:flex;flex-direction:column;}
#connectbar{display:none;align-items:center;gap:8px;font-size:12px;background:var(--bg-accent);color:var(--text-accent);padding:6px 14px;border-bottom:1px solid var(--border-accent);}
#treeview{flex:1;position:relative;overflow:hidden;cursor:grab;background-image:radial-gradient(var(--border) 1px,transparent 1px);background-size:22px 22px;}
#world{position:absolute;top:0;left:0;transform-origin:0 0;}
#treefloat{position:absolute;top:10px;right:10px;display:flex;gap:4px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:3px;box-shadow:var(--shadow);}
#treefloat button{font-size:12px;padding:4px 8px;}
.node{position:absolute;width:176px;height:44px;background:var(--surface-2);border:1px solid var(--border-strong);border-radius:10px;display:flex;align-items:center;gap:7px;padding:0 9px;cursor:pointer;font-size:12.5px;font-weight:500;box-shadow:var(--shadow);user-select:none;}
.node:hover{border-color:var(--border-accent);}
.node.sel{background:var(--bg-accent);border:2px solid var(--fill-accent);color:var(--text-accent);}
.node.connsrc{border:2px dashed var(--conn);}
.node.running{border-color:#1D9E75 !important;box-shadow:0 0 0 4px rgba(29,158,117,.25) !important;}
.node .lb{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.node .badge{flex-shrink:0;font-size:10px;font-weight:600;padding:2px 6px;border-radius:9px;background:var(--surface-1);border:1px solid var(--border-strong);color:var(--text-secondary);}
.nbtn{position:absolute;width:21px;height:21px;border-radius:50%;border:1px solid var(--border-strong);background:var(--surface-2);color:var(--text-secondary);display:none;align-items:center;justify-content:center;padding:0;font-size:12px;box-shadow:var(--shadow);z-index:2;}
.node:hover .nbtn,.node.sel .nbtn{display:flex;}
.nbtn.addbtn{right:-7px;bottom:-9px;}
.nbtn.addbtn:hover{background:var(--fill-accent);color:#fff;}
.nbtn.delbtn{right:-7px;top:-9px;}
.nbtn.delbtn:hover{background:var(--text-danger);color:#fff;}
.port{position:absolute;right:-6px;top:50%;transform:translateY(-50%);width:11px;height:11px;border-radius:50%;background:var(--surface-2);border:2px solid var(--conn);cursor:crosshair;z-index:3;box-sizing:border-box;}
.port:hover{background:var(--conn);}
#previewview{flex:1;display:none;overflow-y:auto;padding:18px;background:var(--surface-1);}
#site{max-width:860px;margin:0 auto;background:#ffffff;color:#1f1e1b;border-radius:12px;border:1px solid var(--border);box-shadow:var(--shadow);overflow:hidden;}
#sitenav{display:flex;align-items:center;gap:4px;padding:12px 18px;border-bottom:1px solid #eceae4;flex-wrap:wrap;}
#sitenav .brand{font-weight:700;font-size:15px;margin-right:auto;}
#sitenav a{font-size:13px;color:#444;padding:5px 10px;border-radius:6px;cursor:pointer;text-decoration:none;}
#sitenav a:hover{background:#f1efe8;}
#sitenav a.cur{background:#eeedfe;color:#4f46b8;font-weight:500;}
#ptabs{display:flex;gap:6px;padding:10px 18px;background:#faf9f6;border-bottom:1px solid #eceae4;flex-wrap:wrap;}
#ptabs button{font-size:12px;border:1px solid #e3e1da;background:#fff;color:#555;border-radius:14px;padding:4px 11px;}
#ptabs button.cur{background:#4f46b8;color:#fff;border-color:#4f46b8;}
#psecs{padding:18px;display:flex;flex-direction:column;gap:12px;min-height:260px;}
.psec{border:1.5px dashed #d9d7cf;border-radius:10px;padding:16px;cursor:pointer;position:relative;transition:border-color .12s;}
.psec:hover{border-color:#afa9ec;}
.psec.sel{border:2px solid #4f46b8;}
.psec .tag{position:absolute;top:-9px;left:12px;font-size:10px;font-weight:600;background:#4f46b8;color:#fff;border-radius:8px;padding:1px 8px;display:none;}
.psec.sel .tag{display:block;}
.psec h3{font-size:15px;font-weight:600;margin-bottom:4px;color:inherit;}
.psec p{font-size:12.5px;color:#77756e;line-height:1.5;}
.psec .fake{margin-top:10px;display:flex;gap:8px;}
.psec .fake i{display:block;height:8px;border-radius:4px;background:rgba(0,0,0,.08);flex:1;}
#props{width:290px;min-width:240px;background:var(--surface-2);border-left:1px solid var(--border);overflow-y:auto;display:flex;flex-direction:column;}
#props .sec{padding:12px 14px;border-bottom:1px solid var(--border);}
.flabel{font-size:11.5px;color:var(--text-secondary);display:block;margin:8px 0 4px;}
.chip{display:inline-flex;font-size:11px;font-weight:600;padding:3px 9px;border-radius:9px;background:var(--bg-accent);color:var(--text-accent);text-transform:capitalize;}
.childrow,.connrow{display:flex;align-items:center;gap:7px;font-size:12.5px;padding:6px 9px;border:1px solid var(--border);border-radius:8px;margin-top:5px;cursor:pointer;}
.childrow:hover{border-color:var(--border-accent);background:var(--bg-accent);}
.connrow{cursor:default;}
.connrow .go{cursor:pointer;color:var(--text-accent);}
.connrow .rm{margin-left:auto;cursor:pointer;color:var(--text-muted);}
.connrow .rm:hover{color:var(--text-danger);}
.swatches{display:flex;gap:6px;margin-top:4px;flex-wrap:wrap;}
.sw{width:22px;height:22px;border-radius:6px;border:1px solid var(--border-strong);cursor:pointer;padding:0;}
.sw:hover{transform:scale(1.12);}
#toast{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:var(--text-primary);color:var(--surface-2);font-size:13px;padding:8px 16px;border-radius:8px;opacity:0;transition:opacity .25s;pointer-events:none;z-index:20;}
#toast.show{opacity:1;}
.hint{font-size:12px;color:var(--text-muted);line-height:1.6;}
@media (max-width:900px){ #chat{width:250px;} #props{width:240px;} }
`;

export const BUILDER_HTML = `
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.24.0/dist/tabler-icons.min.css">

<div id="start">
  <div class="logo"><i class="ti ti-sparkles"></i></div>
  <h1>What do you want to build?</h1>
  <p>Describe your project — Claude designs the architecture and builds it.</p>
  <div id="p0wrap">
    <textarea id="p0" placeholder="e.g. A bakery website with online ordering and a blog"></textarea>
    <div id="p0row"><span id="p0key">No API key — offline demo mode. <b id="p0keySet">Add key</b></span><button class="primary" id="go"><i class="ti ti-arrow-up"></i> Create project</button></div>
  </div>
  <div class="chips">
    <button data-ex="A bakery website with online ordering and a blog">Bakery with online ordering</button>
    <button data-ex="A project management dashboard with reports and team tracking">Project dashboard</button>
    <button data-ex="A portfolio site with gallery and booking for a photographer">Photographer portfolio</button>
  </div>
</div>

<div id="build">
  <div id="topbar">
    <span id="pname"><i class="ti ti-sparkles" style="color:var(--text-accent)"></i> <span id="pnameTxt">Project</span></span>
    <div class="seg" style="margin-left:14px;">
      <button id="vTree" class="on"><i class="ti ti-sitemap" style="font-size:14px"></i> Tree</button>
      <button id="vPrev"><i class="ti ti-eye" style="font-size:14px"></i> Preview</button>
    </div>
    <button id="bUndo" title="Undo last change"><i class="ti ti-arrow-back-up" style="font-size:15px"></i> Undo</button>
    <span style="flex:1"></span>
    <button id="bSave" title="Save project to your account"><i class="ti ti-device-floppy" style="font-size:15px"></i> Save</button>
    <button id="bSet" title="AI settings"><i class="ti ti-settings" style="font-size:15px"></i></button>
    <button id="bProps" title="Show or hide properties"><i class="ti ti-layout-sidebar-right" style="font-size:15px"></i></button>
    <button id="bNew" title="Start a new project"><i class="ti ti-plus" style="font-size:15px"></i> New project</button>
    <button id="bOut" title="Sign out"><i class="ti ti-logout" style="font-size:15px"></i></button>
  </div>
  <div id="body">
    <div id="chat">
      <div id="msgs"></div>
      <div id="chipwrap"><div id="selchip"><i class="ti ti-focus-2" style="font-size:13px"></i><span id="selchipTxt"></span><span class="x" id="selchipX" title="Clear selection">✕</span></div></div>
      <div id="inrow">
        <textarea id="pin" rows="1" placeholder="Describe a change…"></textarea>
        <button class="primary" id="send" title="Send" style="padding:8px 12px;"><i class="ti ti-arrow-up"></i></button>
      </div>
    </div>
    <div id="main">
      <div id="connectbar"><i class="ti ti-plug-connected"></i> <span>Connecting from <b id="connFrom"></b> as</span> <select id="connType" style="font-size:12px;padding:2px 6px;border-radius:6px;border:1px solid var(--border-accent);background:var(--surface-2);color:var(--text-primary);"><option value="nav">navigation</option><option value="data">data</option><option value="event">event</option></select> <span>— click a target, or</span> <button id="connCancel" style="font-size:12px;border:1px solid var(--border-accent);">Cancel</button></div>
      <div id="treeview">
        <div id="world"></div>
        <div id="treefloat">
          <input type="text" id="tSearch" placeholder="Find element…" style="width:110px;padding:4px 8px;font-size:12px;">
          <button id="tExp" title="Expand all"><i class="ti ti-arrows-maximize"></i></button>
          <button id="tCol" title="Collapse all"><i class="ti ti-arrows-minimize"></i></button>
          <button id="tZo" title="Zoom out"><i class="ti ti-minus"></i></button>
          <button id="tZi" title="Zoom in"><i class="ti ti-plus"></i></button>
          <button id="tFit" title="Fit">Fit</button>
        </div>
      </div>
      <div id="previewview">
        <div style="display:flex;justify-content:center;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
          <div class="seg"><button id="mBlue"><i class="ti ti-layout-list" style="font-size:13px"></i> Blueprint</button><button id="mLive" class="on"><i class="ti ti-world" style="font-size:13px"></i> Live site</button></div>
          <div class="seg"><button id="dDesk" class="on"><i class="ti ti-device-desktop" style="font-size:13px"></i> Desktop</button><button id="dMob"><i class="ti ti-device-mobile" style="font-size:13px"></i> Mobile</button></div>
          <button class="primary" id="pBuild"><i class="ti ti-sparkles" style="font-size:13px"></i> <span id="pBuildTxt">Build page with Claude</span></button>
        </div>
        <div id="livetabs" style="display:none;justify-content:center;gap:6px;margin-bottom:12px;flex-wrap:wrap;"></div>
        <div id="site">
          <div id="sitenav"></div>
          <div id="ptabs"></div>
          <div id="psecs"></div>
        </div>
        <div id="siteLive" style="display:none;max-width:860px;margin:0 auto;">
          <iframe id="siteFrame" title="Live site preview" style="width:100%;height:calc(100vh - 200px);border:1px solid var(--border);border-radius:12px;background:#fff;display:block;"></iframe>
        </div>
      </div>
    </div>
    <div id="props"></div>
  </div>
</div>

<div id="setmodal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:15;align-items:center;justify-content:center;">
  <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:14px;padding:20px;width:380px;max-width:92vw;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;"><i class="ti ti-settings" style="font-size:18px;color:var(--text-accent)"></i><b>AI settings</b><span style="flex:1"></span><button id="setClose" title="Close">✕</button></div>
    <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;">Anthropic API key (BYOK — stays in this tab, sent only to Anthropic)</div>
    <input type="password" id="kKey" placeholder="sk-ant-…" style="width:100%;margin-bottom:12px;">
    <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;">Claude models used for routing</div>
    <label style="display:block;font-size:13px;margin:4px 0;"><input type="checkbox" id="kOpus" checked> Claude Opus 4.8</label>
    <label style="display:block;font-size:13px;margin:4px 0;"><input type="checkbox" id="kSonnet" checked> Claude Sonnet 5</label>
    <label style="display:block;font-size:13px;margin:4px 0;"><input type="checkbox" id="kHaiku" checked> Claude Haiku 4.5</label>
    <div style="font-size:12px;color:var(--text-secondary);margin:12px 0 6px;">Routing</div>
    <label style="display:block;font-size:13px;margin:4px 0;"><input type="radio" name="rmode" id="mAuto" checked> Auto — system analyzes the project and decides</label>
    <label style="display:block;font-size:13px;margin:4px 0;"><input type="radio" name="rmode" id="mMan"> Hardcoded — I choose per task</label>
    <div id="manrows" style="opacity:.45;pointer-events:none;margin-top:6px;">
      <div style="display:flex;gap:8px;align-items:center;margin:4px 0;"><span style="font-size:12px;width:110px;">Frontend</span><select id="sFront"><option value="sonnet" selected>Claude Sonnet 5</option><option value="opus">Claude Opus 4.8</option><option value="haiku">Claude Haiku 4.5</option></select></div>
      <div style="display:flex;gap:8px;align-items:center;margin:4px 0;"><span style="font-size:12px;width:110px;">Backend and logic</span><select id="sBack"><option value="sonnet">Claude Sonnet 5</option><option value="opus" selected>Claude Opus 4.8</option><option value="haiku">Claude Haiku 4.5</option></select></div>
      <div style="display:flex;gap:8px;align-items:center;margin:4px 0;"><span style="font-size:12px;width:110px;">Images and UI</span><select id="sMedia"><option value="sonnet">Claude Sonnet 5</option><option value="opus">Claude Opus 4.8</option><option value="haiku" selected>Claude Haiku 4.5</option></select></div>
    </div>
    <button class="primary" id="setDone" style="width:100%;justify-content:center;margin-top:14px;">Done</button>
  </div>
</div>
<div id="toast" role="status"></div>
`;
