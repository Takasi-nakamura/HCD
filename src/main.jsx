import React, {useEffect, useMemo, useRef, useState} from 'react'
import {createRoot} from 'react-dom/client'
import './styles.css'
if ('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('/HCD/sw.js'))

const PARTS=[['text','テキスト','T'],['heading','見出し','H'],['idea','アイデア','✦'],['problem','問題','!'],['solution','解決策','✓'],['goal','目標','◎'],['feature','機能','◆'],['person','人物','●'],['note','メモ','≡'],['image','画像','▧'],['url','URL','↗'],['group','グループ','□'],['arrow','矢印','→'],['separator','区切り','—']]
const initial=[{id:'welcome',type:'heading',x:120,y:90,w:300,h:90,content:'HCDへようこそ'}, {id:'idea',type:'idea',x:470,y:230,w:260,h:150,content:'ここにアイデアを置く'}]
const uid=()=>crypto.randomUUID?.()||Date.now()+Math.random()

function App(){
 const [nodes,setNodes]=useState(()=>JSON.parse(localStorage.getItem('hcd.nodes')||'null')||initial)
 const [edges,setEdges]=useState(()=>JSON.parse(localStorage.getItem('hcd.edges')||'null')||[])
 const [project,setProject]=useState(()=>localStorage.getItem('hcd.project')||'Untitled')
 const [selected,setSelected]=useState(null), [tab,setTab]=useState('parts'), [zoom,setZoom]=useState(1)
 const [apiKey,setApiKey]=useState(()=>localStorage.getItem('hcd.geminiKey')||''), [prompt,setPrompt]=useState('')
 const [proposal,setProposal]=useState(null), [history,setHistory]=useState([]), [redo,setRedo]=useState([])
 const canvas=useRef(null), drag=useRef(null)
 useEffect(()=>{localStorage.setItem('hcd.nodes',JSON.stringify(nodes));localStorage.setItem('hcd.edges',JSON.stringify(edges));localStorage.setItem('hcd.project',project)},[nodes,edges,project])
 const sel=useMemo(()=>nodes.find(n=>n.id===selected),[nodes,selected])
 const commit=(next)=>{setHistory(h=>[...h,{nodes,edges}].slice(-30));setRedo([]);next()}
 const addPart=(type)=>{const n={id:uid(),type,x:160+Math.random()*420,y:100+Math.random()*300,w:type==='heading'?300:230,h:type==='heading'?80:130,content:type==='arrow'?'→':type==='separator'?'':'新しい'+(PARTS.find(p=>p[0]===type)?.[1]||'パーツ')};commit(()=>setNodes(v=>[...v,n]));setSelected(n.id)}
 const update=(patch)=>{commit(()=>setNodes(v=>v.map(n=>n.id===selected?{...n,...patch}:n)))}
 const remove=()=>{if(!sel)return;commit(()=>{setNodes(v=>v.filter(n=>n.id!==selected));setEdges(v=>v.filter(e=>e.source!==selected&&e.target!==selected))});setSelected(null)}
 const pointerDown=(e,n)=>{if(e.target.closest('textarea'))return; e.stopPropagation();setSelected(n.id);drag.current={id:n.id,sx:e.clientX,sy:e.clientY,x:n.x,y:n.y}}
 useEffect(()=>{const move=e=>{if(!drag.current)return;const d=drag.current;setNodes(v=>v.map(n=>n.id===d.id?{...n,x:d.x+(e.clientX-d.sx)/zoom,y:d.y+(e.clientY-d.sy)/zoom}:n))};const up=()=>{if(drag.current){setHistory(h=>[...h,{nodes,edges}].slice(-30));setRedo([])}drag.current=null};window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);return()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up)}},[zoom,nodes,edges])
 const undo=()=>{const x=history.at(-1);if(!x)return;setRedo(r=>[...r,{nodes,edges}]);setNodes(x.nodes);setEdges(x.edges);setHistory(h=>h.slice(0,-1))}
 const redoAction=()=>{const x=redo.at(-1);if(!x)return;setHistory(h=>[...h,{nodes,edges}]);setNodes(x.nodes);setEdges(x.edges);setRedo(r=>r.slice(0,-1))}
 const exportProject=()=>{const blob=new Blob([JSON.stringify({version:1,name:project,nodes,edges},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${project||'HCD'}.json`;a.click()}
 const importProject=e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const x=JSON.parse(r.result);commit(()=>{setNodes(x.nodes||[]);setEdges(x.edges||[]);setProject(x.name||'Untitled')})}catch{alert('JSONを読み込めませんでした')}};r.readAsText(f)}
 const askAI=async()=>{if(!apiKey){alert('AIタブでGemini APIキーを入力してください');setTab('ai');return}if(!prompt.trim())return;const context=nodes.map(n=>({id:n.id,type:n.type,content:n.content,x:n.x,y:n.y}));const body={contents:[{parts:[{text:`あなたはHCDのキャンバス編集AIです。現在のキャンバス:${JSON.stringify(context)}\nユーザーの依頼:${prompt}\n変更を提案する場合はJSONのみで返してください。形式: {"summary":"説明","operations":[{"op":"create_node","type":"idea","content":"...","x":100,"y":100},{"op":"update_node","id":"...","content":"..."},{"op":"connect","source":"...","target":"..."}]}。変更不要ならoperations=[]。`}]}]};try{const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key='+encodeURIComponent(apiKey),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const j=await r.json();const text=j.candidates?.[0]?.content?.parts?.[0]?.text||'';const clean=text.replace(/^```json\s*/,'').replace(/\s*```$/,'');setProposal(JSON.parse(clean))}catch(err){alert('AIの応答を取得できませんでした')}}
 const applyProposal=()=>{if(!proposal)return;commit(()=>{let ns=[...nodes],es=[...edges];for(const o of proposal.operations||[]){if(o.op==='create_node')ns.push({id:uid(),type:o.type||'text',x:o.x||100,y:o.y||100,w:230,h:130,content:o.content||''});if(o.op==='update_node')ns=ns.map(n=>n.id===o.id?{...n,content:o.content??n.content}:n);if(o.op==='connect'&&ns.some(n=>n.id===o.source)&&ns.some(n=>n.id===o.target))es.push({id:uid(),source:o.source,target:o.target})}setNodes(ns);setEdges(es)});setProposal(null)}
 return <div className="app">
  <header><div className="brand">HCD</div><input className="project" value={project} onChange={e=>setProject(e.target.value)}/><div className="actions"><button onClick={undo} disabled={!history.length}>↶</button><button onClick={redoAction} disabled={!redo.length}>↷</button><button onClick={exportProject}>書き出す</button><label className="import">読み込む<input type="file" accept="application/json" onChange={importProject}/></label></div></header>
  <div className="body"><aside><button className={tab==='parts'?'active':''} onClick={()=>setTab('parts')}>パーツ</button><button className={tab==='ai'?'active':''} onClick={()=>setTab('ai')}>AI</button><div className="asideBottom">{PARTS.slice(0,5).map(p=><button key={p[0]} title={p[1]} onClick={()=>addPart(p[0])}>{p[2]}</button>)}</div></aside>
   <main className="workspace"><div className="toolbar"><span>{nodes.length} パーツ</span><div><button onClick={()=>setZoom(z=>Math.max(.5,z-.1))}>−</button><b>{Math.round(zoom*100)}%</b><button onClick={()=>setZoom(z=>Math.min(2,z+.1))}>＋</button></div></div>
    <div className="canvas" ref={canvas} onPointerDown={()=>setSelected(null)} style={{'--zoom':zoom}}><div className="grid"/>{nodes.map(n=><div key={n.id} className={`node ${n.type} ${selected===n.id?'selected':''}`} style={{left:n.x*zoom,top:n.y*zoom,width:n.w*zoom,minHeight:n.h*zoom}} onPointerDown={e=>pointerDown(e,n)}><div className="nodeLabel">{PARTS.find(p=>p[0]===n.type)?.[1]||n.type}</div><textarea value={n.content} onChange={e=>update({content:e.target.value})}/></div>)}</div>
   </main>
   <section className="panel">{tab==='parts'?<><h3>パーツ</h3><p className="muted">キャンバスに置いて、自由に組み立てる。</p><div className="parts">{PARTS.map(p=><button key={p[0]} onClick={()=>addPart(p[0])}><i>{p[2]}</i><span>{p[1]}</span></button>)}</div>{sel&&<div className="inspector"><h3>選択中</h3><select value={sel.type} onChange={e=>update({type:e.target.value})}>{PARTS.map(p=><option key={p[0]} value={p[0]}>{p[1]}</option>)}</select><button className="danger" onClick={remove}>削除</button></div>}</>:<div className="ai"><h3>AI</h3><p className="muted">HCDのキャンバスを整理するAI。</p><label>Gemini APIキー<input type="password" value={apiKey} onChange={e=>{setApiKey(e.target.value);localStorage.setItem('hcd.geminiKey',e.target.value)}} placeholder="AIza..."/></label><textarea value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="例：このアイデアを整理して、問題・解決策・目標に分けて"/><button className="primary" onClick={askAI}>提案を作る</button>{proposal&&<div className="proposal"><b>{proposal.summary||'変更提案'}</b><ul>{(proposal.operations||[]).map((o,i)=><li key={i}>{o.op} {o.content||''}</li>)}</ul><div><button className="primary" onClick={applyProposal}>承認して適用</button><button onClick={()=>setProposal(null)}>却下</button></div></div>}</div>}</section>
  </div>
 </div>
}
createRoot(document.getElementById('root')).render(<App/>)
