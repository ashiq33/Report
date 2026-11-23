import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Activity, ArrowUpRight, BarChart3, CalendarDays, CheckCircle2,
  ClipboardList, Download, Eye, FileSpreadsheet, Filter,
  History, MessageCircle, Package, Plus, Search, Send,
  TrendingUp, Upload, Users, Warehouse, XCircle
} from "lucide-react";
import { Shell, PageTitle, StatCard } from "./components";
import type { Report, ReportInput, Role } from "./types";
import { emptyReport } from "./types";
import { achievement, dateLabel, number, percent } from "./lib/format";
import { getReports, saveReport } from "./lib/store";
import { downloadTemplate, parseWorkbook } from "./lib/excel";
import { makeWhatsAppReport } from "./lib/reportText";
import { downloadReportPdf } from "./lib/pdf";
import { isSupabaseConfigured, supabase, supabaseConfigError } from "./lib/supabase";
import "./app.css";

function useReports(enabled: boolean, locationKey: string, pathname: string, search: string) {
  const [reports,setReports]=useState<Report[]>([]);
  const [loading,setLoading]=useState(enabled);
  const [error,setError]=useState("");

  const refresh=useCallback(async()=>{
    if(!enabled) {
      setReports([]);
      setLoading(false);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const rows=await getReports();
      setReports(rows);
    } catch(e) {
      const message=e instanceof Error?e.message:String(e);
      const code=(e as {code?:string})?.code;
      if(code==="42501" || /row.level security|permission denied|not allowed/i.test(message)) {
        setError("Supabase blocked this report request (RLS/permissions). Check the user's profile role and database policies.");
      } else if(/fetch|network|failed to connect|load failed/i.test(message)) {
        setError("Cannot reach Supabase. Check the Project URL, publishable key, and network connection.");
      } else {
        setError(`Could not load reports: ${message}`);
      }
    } finally {
      setLoading(false);
    }
  },[enabled]);

  useEffect(()=>{
    void refresh();
  },[refresh,locationKey,pathname,search]);

  return {reports,loading,error,refresh,setReports};
}

function Dashboard({reports,loading,role}:{reports:Report[];loading:boolean;role:Role}) {
  const [period,setPeriod]=useState("month");
  const latest=reports[0];
  if(!latest) return <>
    <PageTitle title="Production dashboard" subtitle="Daily production performance and department overview." action={role==="admin"?<Link className="btn btn-primary" to="/reports/new"><Plus size={16}/> New report</Link>:undefined}/>
    {loading?<div className="notice">Loading reports…</div>:<div className="panel empty-state">No reports have been saved in Supabase yet.</div>}
  </>;
  const achievementPct=achievement(latest.dailyProductionMtr,latest.dailyTargetMtr);
  const monthlyPct=achievement(latest.monthlyProductionMtr,latest.monthlyOrderMtr);
  const remaining=Math.max(0,latest.monthlyOrderMtr-latest.monthlyProductionMtr);
  const avgRollWeight=latest.dailyProductionRolls>0?latest.dailyProductionKg/latest.dailyProductionRolls:0;
  const chartRows=[...reports].slice(0,7).reverse();
  const segments=Math.max(0,Math.min(10,Math.round(monthlyPct/10)));
  return <div className="editorial-dashboard">
    <PageTitle title="Production dashboard" subtitle="A clear view of daily output, order progress and department performance." action={<Link className="btn btn-primary" to={role==="admin"?"/reports/new":"/history"}>{role==="admin"?<><Plus size={16}/> New report</>:<><History size={16}/> View reports</>}</Link>}/>
    {loading&&<div className="notice">Refreshing production data…</div>}
    <div className="overview-kicker"><div><span className="eyebrow">LATEST PRODUCTION REPORT</span><h3>{dateLabel(latest.reportingDate)}</h3></div><span className={`pill ${latest.status==="submitted"?"pill-green":"pill-yellow"}`}><span className="tiny-dot"/> {latest.status}</span></div>
    <section className="hero-output">
      <div className="hero-copy"><span className="hero-eyebrow">DAILY OUTPUT · WARP KNITTING</span><div className="hero-value">{number(latest.dailyProductionMtr)}<span>MTR</span></div><p>Production completed for the reporting day</p><div className="hero-meta"><span className="hero-status"><i/> {latest.status}</span><span className="hero-target">{number(achievementPct,2)}% of daily target</span></div></div>
      <div className="hero-side"><div className="hero-side-label">DAILY TARGET</div><strong>{number(latest.dailyTargetMtr)} <small>MTR</small></strong><div className="hero-side-rule"/><div className="hero-side-label">OUTPUT DETAILS</div><div className="hero-detail"><span>Weight</span><b>{number(latest.dailyProductionKg,2)} KG</b></div><div className="hero-detail"><span>Rolls</span><b>{number(latest.dailyProductionRolls)}</b></div></div>
      <div className="hero-watermark">WK</div>
    </section>
    <section className="bento-grid" aria-label="Production metrics">
      <article className="bento-card monthly-card"><div className="bento-top"><span className="metric-label">Monthly production</span><span className="metric-icon"><BarChart3 size={18}/></span></div><div className="metric-value">{number(latest.monthlyProductionMtr)}<small>MTR</small></div><div className="segment-progress" aria-label={`${number(monthlyPct,2)} percent monthly completion`}>{Array.from({length:10},(_,i)=><i key={i} className={i<segments?"filled":""}/>)}</div><div className="metric-foot"><span>{number(monthlyPct,2)}% of monthly order</span><b>{number(latest.monthlyOrderMtr)} MTR order</b></div></article>
      <article className="bento-card"><div className="bento-top"><span className="metric-label">Remaining order</span><span className="metric-icon amber"><Package size={18}/></span></div><div className="metric-value">{number(remaining)}<small>MTR</small></div><div className="metric-foot"><span>Balance to complete</span><b className="warning-text">{number(latest.monthlyOrderMtr)} MTR total</b></div></article>
      <article className="bento-card"><div className="bento-top"><span className="metric-label">Daily achievement</span><span className="metric-icon emerald"><TrendingUp size={18}/></span></div><div className={`metric-value ${achievementPct>=100?"positive-text":""}`}>{percent(achievementPct)}</div><div className="metric-foot"><span>Against daily target</span><b className={achievementPct>=100?"positive-text":"warning-text"}>{achievementPct>=100?"Above target":"Below target"}</b></div></article>
      <article className="bento-card"><div className="bento-top"><span className="metric-label">Average roll weight</span><span className="metric-icon"><Package size={18}/></span></div><div className="metric-value">{number(avgRollWeight,2)}<small>KG / ROLL</small></div><div className="metric-foot"><span>Daily average</span><b>{number(latest.dailyProductionRolls)} rolls recorded</b></div></article>
    </section>
    <div className="dashboard-grid editorial-lower-grid">
      <section className="panel chart-panel"><div className="panel-head"><div><h3>Daily production trend</h3><p>Actual output compared with target</p></div><span className="select-wrap"><select value={period} onChange={e=>setPeriod(e.target.value)}><option value="month">Recent reports</option><option value="all">All available</option></select></span></div>
        {chartRows.length>1?<div className="bar-chart">{(period==="all"?[...reports].reverse():chartRows).map(r=><div className="bar-group" key={r.id}><div className="bar-pair"><div className="bar actual" style={{height:`${Math.max(3,Math.min(100,r.dailyTargetMtr?r.dailyProductionMtr/Math.max(...reports.map(x=>Math.max(x.dailyProductionMtr,x.dailyTargetMtr)),1)*100:0))}%`}} title={`${number(r.dailyProductionMtr)} MTR`}/><div className="bar target" style={{height:`${Math.max(3,Math.min(100,r.dailyTargetMtr/Math.max(...reports.map(x=>Math.max(x.dailyProductionMtr,x.dailyTargetMtr)),1)*100))}%`}} title={`${number(r.dailyTargetMtr)} MTR target`}/></div><small>{new Date(r.reportingDate+"T00:00:00").toLocaleDateString("en-GB",{day:"2-digit",month:"short"})}</small></div>)}</div>:<div className="empty-chart"><BarChart3 size={28}/><b>Production history will appear here</b><span>Save more daily reports to build your trend.</span></div>}
        <div className="chart-legend"><span><i className="legend-blue"/>Actual production</span><span><i className="legend-grey"/>Target</span></div>
      </section>
      <section className="panel progress-panel"><div className="panel-head"><div><h3>Order progress</h3><p>Current reporting month</p></div><CalendarDays size={19} className="muted"/></div><div className="progress-number">{number(monthlyPct,2)}<small>%</small></div><div className="progress-track"><div className="progress-fill" style={{width:`${Math.min(100,monthlyPct)}%`}}/></div><div className="progress-meta"><span>{number(latest.monthlyProductionMtr)} MTR produced</span><span>{number(latest.monthlyOrderMtr)} MTR</span></div><div className="mini-stat"><span>Remaining quantity</span><b>{number(remaining)} MTR</b></div><div className="mini-stat"><span>SAP confirmation</span><b>{number(latest.sapConfirmationMtr)} MTR</b></div></section>
    </div>
    <div className="dashboard-grid lower-grid"><section className="panel"><div className="panel-head"><div><h3>Stock position</h3><p>Latest reported stock by category</p></div><Link to="/stock" className="text-link">View all</Link></div><div className="stock-list">{latest.stocks.slice(0,5).map(s=><div className="stock-row" key={s.category}><div className="stock-name"><span className="stock-dot"/><b>{s.category}</b></div><strong>{number(s.mtr)} <small>MTR</small></strong></div>)}</div></section>
      <section className="panel"><div className="panel-head"><div><h3>Department resources</h3><p>Manpower and machine availability</p></div><Users size={19} className="muted"/></div><div className="resource-grid"><div><span>Manpower</span><b>{latest.totalPresent}/{latest.totalRequired}</b><small>{Math.max(0,latest.totalRequired-latest.totalPresent)} shortage</small></div><div><span>Shifting</span><b>{latest.shiftingPresent}/{latest.shiftingRequired}</b><small>Present / required</small></div><div><span>Warping machines</span><b>{number(latest.warpingMachines)}</b><small>Reported machines</small></div><div><span>Knitting machines</span><b>{number(latest.knittingMachines)}</b><small>Reported machines</small></div></div></section></div>
    <div className="panel table-panel"><div className="panel-head"><div><h3>Recent reports</h3><p>Latest reporting activity</p></div><Link to="/history" className="text-link">Full history <ArrowUpRight size={14}/></Link></div><ReportTable reports={reports.slice(0,5)}/></div>
  </div>;
}

function ReportTable({reports}:{reports:Report[]}) {
  if(!reports.length)return <div className="empty-state">No reports have been saved yet.</div>;
  return <div className="table-wrap"><table><thead><tr><th>Reporting date</th><th>Production date</th><th>Daily production</th><th>Target achievement</th><th>Monthly production</th><th>Status</th><th/></tr></thead><tbody>{reports.map(r=><tr key={r.id}><td><b>{dateLabel(r.reportingDate)}</b></td><td>{dateLabel(r.productionDate)}</td><td>{number(r.dailyProductionMtr)} MTR</td><td><span className={achievement(r.dailyProductionMtr,r.dailyTargetMtr)>=100?"text-green":"text-orange"}>{percent(achievement(r.dailyProductionMtr,r.dailyTargetMtr))}</span></td><td>{number(r.monthlyProductionMtr)} MTR</td><td><span className={`pill ${r.status==="submitted"?"pill-green":"pill-yellow"}`}>{r.status}</span></td><td><Link className="icon-btn" to={`/reports/${r.id}`} title="View report"><Eye size={16}/></Link></td></tr>)}</tbody></table></div>;
}

function ExcelImport({onImported,role}:{onImported:(r:Report)=>void;role:Role}) {
  const [file,setFile]=useState<File|null>(null);
  const [parsed,setParsed]=useState<Awaited<ReturnType<typeof parseWorkbook>>|null>(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const navigate=useNavigate();
  const load=async(f:File)=>{setFile(f);setError("");setMessage("");setBusy(true);try{setParsed(await parseWorkbook(f));}catch(e){setError(e instanceof Error?e.message:"Unable to read workbook");setParsed(null);}finally{setBusy(false);}};
  const confirm=async()=>{if(!parsed||parsed.errors.length)return;setBusy(true);try{const saved=await saveReport(parsed.report);onImported(saved);setMessage("Report imported and saved successfully.");setTimeout(()=>navigate(`/reports/${saved.id}`),500);}catch(e){setError(e instanceof Error?e.message:"Could not save report");}finally{setBusy(false);}};
  if(role!=="admin")return <div className="notice notice-warning">Excel import is available to administrators only.</div>;
  return <>
    <PageTitle title="Excel Import" subtitle="Upload the daily reporting workbook and review the figures before saving." action={<button className="btn btn-secondary" onClick={downloadTemplate}><Download size={16}/> Download template</button>}/>
    <div className="import-layout">
      <section className="panel upload-panel"><div className="upload-icon"><FileSpreadsheet size={28}/></div><h3>Upload daily report workbook</h3><p>Choose the standard Warp Knitting template (.xlsx or .xls).</p><label className="dropzone"><Upload size={25}/><b>{file?file.name:"Drag your Excel file here"}</b><span>{file?"File selected":"or click to browse your computer"}</span><input type="file" accept=".xlsx,.xls" onChange={e=>e.target.files?.[0]&&load(e.target.files[0])}/></label>{busy&&<div className="notice">Processing workbook…</div>}{error&&<div className="notice notice-error">{error}</div>}{message&&<div className="notice notice-success">{message}</div>}<div className="template-info"><b>Workbook structure</b><span><i/> Production — daily and monthly figures</span><span><i/> Stock — greige and other fabric stock</span><span><i/> Resources — yarn, manpower and machines</span></div></section>
      <section className="panel import-guide"><h3>Import process</h3>{["Download the standard Excel template.","Enter your daily production, stock and resource data.","Upload the completed workbook.","Review errors and warnings in the preview.","Confirm to save the report."].map((s,i)=><div className="guide-step" key={s}><span>{i+1}</span><p>{s}</p></div>)}<div className="notice notice-warning">An existing reporting date may be updated when you confirm the import. Check the date carefully before saving.</div></section>
    </div>
    {parsed&&<section className="panel preview-panel"><div className="panel-head"><div><h3>Import validation</h3><p>{file?.name} · {parsed.errors.length} errors · {parsed.warnings.length} warnings</p></div><span className={`pill ${parsed.errors.length?"pill-red":"pill-green"}`}>{parsed.errors.length?"Needs correction":"Ready to import"}</span></div>{parsed.errors.map(e=><div className="validation-error" key={e}><XCircle size={15}/>{e}</div>)}{parsed.warnings.map(e=><div className="validation-warning" key={e}><Activity size={15}/>{e}</div>)}<div className="preview-grid"><div><small>Reporting date</small><b>{dateLabel(parsed.report.reportingDate)}</b></div><div><small>Daily production</small><b>{number(parsed.report.dailyProductionMtr)} MTR</b></div><div><small>Monthly production</small><b>{number(parsed.report.monthlyProductionMtr)} MTR</b></div><div><small>Daily target</small><b>{number(parsed.report.dailyTargetMtr)} MTR</b></div></div><div className="table-wrap"><table><thead><tr><th>Stock category</th><th>MTR</th><th>KG</th><th>Rolls</th></tr></thead><tbody>{parsed.report.stocks.map(s=><tr key={s.category}><td>{s.category}</td><td>{number(s.mtr)}</td><td>{number(s.kg,2)}</td><td>{number(s.rolls)}</td></tr>)}</tbody></table></div><div className="form-actions"><button className="btn btn-secondary" onClick={()=>{setParsed(null);setFile(null);}}>Cancel</button><button className="btn btn-primary" disabled={busy||parsed.errors.length>0} onClick={confirm}><CheckCircle2 size={16}/> Confirm import</button></div></section>}
  </>;
}

function ReportEditor({onSaved,role,existing}:{onSaved:(r:Report)=>void;role:Role;existing?:Report}) {
  const [form,setForm]=useState<ReportInput>(existing?{...existing}:emptyReport());
  const [saving,setSaving]=useState(false);const [error,setError]=useState("");const navigate=useNavigate();
  useEffect(()=>{if(existing)setForm({...existing});},[existing]);
  if(role!=="admin")return <div className="notice notice-warning">Only administrators can create or edit reports.</div>;
  const set=(key:keyof ReportInput,value:unknown)=>setForm(old=>({...old,[key]:value}));
  const num=(key:keyof ReportInput,value:string)=>set(key, value===""?0:Number(value));
  const setStock=(index:number,key:"mtr"|"kg"|"rolls",value:string)=>setForm(old=>({...old,stocks:old.stocks.map((s,i)=>i===index?{...s,[key]:value===""?0:Number(value)}:s)}));
  const save=async(status:"draft"|"submitted")=>{setSaving(true);setError("");try{const saved=await saveReport({...form,status});onSaved(saved);navigate(`/reports/${saved.id}`);}catch(e){setError(e instanceof Error?e.message:"Unable to save report");}finally{setSaving(false);}};
  const fields:[keyof ReportInput,string,string][]=[
    ["monthlyOrderMtr","Monthly order quantity","MTR"],["monthlyProductionMtr","Monthly production","MTR"],["monthlyProductionKg","Monthly production weight","KG"],["monthlyProductionRolls","Monthly production rolls","Rolls"],["sapConfirmationMtr","SAP production confirmation","MTR"],["dailyProductionMtr","Daily production","MTR"],["dailyProductionKg","Daily production weight","KG"],["dailyProductionRolls","Daily production rolls","Rolls"],["dailyTargetMtr","Daily target","MTR"],["columbiaMtr","Columbia production","MTR"],["columbiaKg","Columbia weight","KG"],["columbiaRolls","Columbia rolls","Rolls"],["columbiaTargetMtr","Columbia target","MTR"]
  ];
  const resourceFields:[keyof ReportInput,string][]=[
    ["apmYarnKg","APM yarn stock (KG)"],["sapYarnKg","SAP yarn stock (KG)"],
    ["totalPresent","Total manpower present"],["totalRequired","Total manpower required"],
    ["shiftingPresent","Shifting present"],["shiftingRequired","Shifting required"],
    ["generalPresent","General present"],["generalRequired","General required"],["leaveCount","Leave"],
    ["warpingMachines","Warping machines"],["knittingMachines","Knitting machines"]
  ];
  return <>
    <PageTitle title={existing?"Edit report":"Create daily report"} subtitle="Enter reporting details and production figures. All quantities are stored as numeric values."/>
    {error&&<div className="notice notice-error">{error}</div>}
    <section className="panel form-panel"><div className="form-section-title"><span>01</span><div><h3>Reporting information</h3><p>Reporting and production dates are stored separately.</p></div></div><div className="form-grid"><Field label="Reporting date" value={form.reportingDate} type="date" onChange={v=>set("reportingDate",v)}/><Field label="Production date" value={form.productionDate} type="date" onChange={v=>set("productionDate",v)}/></div></section>
    <section className="panel form-panel"><div className="form-section-title"><span>02</span><div><h3>Production figures</h3><p>Monthly, daily and Columbia production.</p></div></div><div className="form-grid">{fields.map(([key,label,unit])=><Field key={String(key)} label={label} unit={unit} value={String(form[key]??0)} onChange={v=>num(key,v)}/>)}</div><div className="calculated-row"><div><small>Daily achievement</small><b>{percent(achievement(form.dailyProductionMtr,form.dailyTargetMtr))}</b></div><div><small>Monthly achievement</small><b>{percent(achievement(form.monthlyProductionMtr,form.monthlyOrderMtr))}</b></div><div><small>Columbia achievement</small><b>{percent(achievement(form.columbiaMtr,form.columbiaTargetMtr))}</b></div></div></section>
    <section className="panel form-panel"><div className="form-section-title"><span>03</span><div><h3>Stock information</h3><p>Keep physical and SAP stock figures separate.</p></div></div><div className="table-wrap"><table className="editable-table"><thead><tr><th>Stock category</th><th>MTR</th><th>KG</th><th>Rolls</th></tr></thead><tbody>{form.stocks.map((s,i)=><tr key={s.category}><td><b>{s.category}</b></td>{(["mtr","kg","rolls"] as const).map(k=><td key={k}><input type="number" min="0" value={s[k]} onChange={e=>setStock(i,k,e.target.value)}/></td>)}</tr>)}</tbody></table></div></section>
    <section className="panel form-panel"><div className="form-section-title"><span>04</span><div><h3>Yarn, manpower and machines</h3><p>Resource position for the reporting date.</p></div></div><div className="form-grid">{resourceFields.map(([key,label])=><Field key={String(key)} label={label} value={String(form[key]??0)} onChange={v=>num(key,v)}/>)}</div></section>
    <section className="panel form-panel"><div className="form-section-title"><span>05</span><div><h3>Remarks</h3><p>Optional production issues or management notes.</p></div></div><textarea className="textarea" rows={4} value={form.remarks} onChange={e=>set("remarks",e.target.value)} placeholder="Enter remarks…"/></section>
    <div className="sticky-actions"><button className="btn btn-secondary" disabled={saving} onClick={()=>save("draft")}>Save draft</button><button className="btn btn-primary" disabled={saving} onClick={()=>save("submitted")}><Send size={16}/>{saving?"Saving…":"Submit report"}</button></div>
  </>;
}

function Field({label,value,onChange,unit,type="number"}:{label:string;value:string;onChange:(v:string)=>void;unit?:string;type?:"number"|"date"|"email"}) {
  return <label className="field"><span>{label}{unit&&<small>{unit}</small>}</span><input type={type} min={type==="number"?0:undefined} step="any" value={value} onChange={e=>onChange(e.target.value)}/></label>;
}

function ReportDetail({reports,role,onRefresh,onSaved}:{reports:Report[];role:Role;onRefresh:()=>void;onSaved:(r:Report)=>void}) {
  const {id}=useParams();const r=reports.find(x=>x.id===id);const navigate=useNavigate();
  const [copied,setCopied]=useState(false);
  if(!r)return <div className="empty-state">Report not found. <Link to="/history" className="text-link">Return to history</Link></div>;
  const text=makeWhatsAppReport(r);
  const copy=async()=>{await navigator.clipboard.writeText(text);setCopied(true);setTimeout(()=>setCopied(false),1800);};
  const share=()=>window.open(`https://wa.me/?text=${encodeURIComponent(text)}`,"_blank","noopener,noreferrer");
  return <>
    <PageTitle title="Report details" subtitle={`Reporting date ${dateLabel(r.reportingDate)} · Production date ${dateLabel(r.productionDate)}`} action={<button className="btn btn-secondary" onClick={()=>downloadReportPdf(r)}><Download size={16}/> Download PDF</button>}/>
    <div className="detail-actions"><span className={`pill ${r.status==="submitted"?"pill-green":"pill-yellow"}`}>{r.status}</span>{role==="admin"&&<Link className="btn btn-secondary" to={`/reports/${r.id}/edit`}>Edit report</Link>}<button className="btn btn-secondary" onClick={copy}><ClipboardList size={16}/>{copied?"Copied":"Copy WhatsApp text"}</button><button className="btn btn-whatsapp" onClick={share}><MessageCircle size={16}/> Share on WhatsApp</button></div>
    <div className="stats-grid compact"><StatCard label="Daily production" value={number(r.dailyProductionMtr)} unit="MTR" icon={<Activity/>}/><StatCard label="Daily achievement" value={percent(achievement(r.dailyProductionMtr,r.dailyTargetMtr))} icon={<TrendingUp/>} tone="green"/><StatCard label="Monthly production" value={number(r.monthlyProductionMtr)} unit="MTR" icon={<BarChart3/>}/><StatCard label="Yarn stock difference" value={number(r.apmYarnKg-r.sapYarnKg,2)} unit="KG" icon={<Package/>}/></div>
    <div className="detail-grid"><section className="panel"><h3>Production summary</h3><DataRows rows={[["Monthly order",`${number(r.monthlyOrderMtr)} MTR`],["Monthly production",`${number(r.monthlyProductionMtr)} MTR`],["Monthly weight",`${number(r.monthlyProductionKg,2)} KG`],["Monthly rolls",number(r.monthlyProductionRolls)],["SAP confirmation",`${number(r.sapConfirmationMtr)} MTR`],["Daily target",`${number(r.dailyTargetMtr)} MTR`],["Columbia production",`${number(r.columbiaMtr)} MTR`],["Columbia target",`${number(r.columbiaTargetMtr)} MTR`]]}/></section><section className="panel"><h3>Manpower and machines</h3><DataRows rows={[["Total manpower",`${r.totalPresent}/${r.totalRequired}`],["Shifting",`${r.shiftingPresent}/${r.shiftingRequired}`],["General",`${r.generalPresent}/${r.generalRequired}`],["Leave",number(r.leaveCount)],["Warping machines",number(r.warpingMachines)],["Knitting machines",number(r.knittingMachines)],["APM yarn stock",`${number(r.apmYarnKg,2)} KG`],["SAP yarn stock",`${number(r.sapYarnKg,2)} KG`]]}/></section></div>
    <section className="panel"><h3>Stock details</h3><div className="table-wrap"><table><thead><tr><th>Category</th><th>MTR</th><th>KG</th><th>Rolls</th></tr></thead><tbody>{r.stocks.map(s=><tr key={s.category}><td>{s.category}</td><td>{number(s.mtr)}</td><td>{number(s.kg,2)}</td><td>{number(s.rolls)}</td></tr>)}</tbody></table></div></section>
    {r.remarks&&<section className="panel"><h3>Remarks</h3><p>{r.remarks}</p></section>}
    <section className="panel"><div className="panel-head"><div><h3>WhatsApp message</h3><p>Ready-to-share report text</p></div><button className="btn btn-secondary btn-small" onClick={copy}><ClipboardList size={14}/> Copy</button></div><pre className="whatsapp-preview">{text}</pre></section>
  </>;
}
function DataRows({rows}:{rows:[string,string][]}){return <div className="data-rows">{rows.map(([a,b])=><div key={a}><span>{a}</span><b>{b}</b></div>)}</div>}

function HistoryPage({reports}:{reports:Report[]}) {
  const [query,setQuery]=useState("");const [status,setStatus]=useState("all");
  const filtered=reports.filter(r=>(r.reportingDate.includes(query)||r.productionDate.includes(query))&&(status==="all"||r.status===status));
  return <><PageTitle title="Report history" subtitle="Search, review and reopen previous daily reports."/><section className="panel"><div className="filter-row"><label className="search-box"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search by date (YYYY-MM-DD)"/></label><label className="select-wrap"><Filter size={16}/><select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All statuses</option><option value="submitted">Submitted</option><option value="draft">Draft</option></select></label></div><ReportTable reports={filtered}/><div className="table-foot">{filtered.length} report(s) found</div></section></>;
}

function Analytics({reports}:{reports:Report[]}) {
  const [month,setMonth]=useState(new Date().toISOString().slice(0,7));
  const rows=reports.filter(r=>r.reportingDate.startsWith(month));
  const totalDaily=rows.reduce((a,r)=>a+r.dailyProductionMtr,0);
  return <><PageTitle title="Production analytics" subtitle="Review daily production and reporting trends."/><section className="panel"><div className="panel-head"><div><h3>Monthly reporting analysis</h3><p>Daily production entries for selected month</p></div><input className="month-input" type="month" value={month} onChange={e=>setMonth(e.target.value)}/></div><div className="stats-grid compact"><StatCard label="Reports" value={number(rows.length)} icon={<ClipboardList/>}/><StatCard label="Sum of daily production" value={number(totalDaily)} unit="MTR" icon={<Activity/>}/><StatCard label="Latest monthly total" value={number(rows[0]?.monthlyProductionMtr??0)} unit="MTR" icon={<BarChart3/>}/><StatCard label="Average daily production" value={number(rows.length?totalDaily/rows.length:0)} unit="MTR" icon={<TrendingUp/>}/></div><ReportTable reports={rows}/></section></>;
}

function StockPage({reports}:{reports:Report[]}) {
  const r=reports[0];
  if(!r)return <><PageTitle title="Stock overview" subtitle="Stock position from the latest saved production report."/><div className="panel empty-state">No stock data is available yet.</div></>;
  const items=r.stocks;
  return <><PageTitle title="Stock overview" subtitle={`Stock position from report dated ${dateLabel(r.reportingDate)}. Physical and SAP figures remain separate.`}/><div className="stats-grid"><StatCard label="Physical greige" value={number(items.find(s=>s.category==="Physical Greige")?.mtr??0)} unit="MTR" icon={<Warehouse/>}/><StatCard label="Glostom greige" value={number(items.find(s=>s.category==="Glostom Greige")?.mtr??0)} unit="MTR" icon={<Package/>}/><StatCard label="SAP greige" value={number(items.find(s=>s.category==="SAP Greige")?.mtr??0)} unit="MTR" icon={<BarChart3/>}/><StatCard label="Yarn stock difference" value={number(r.apmYarnKg-r.sapYarnKg,2)} unit="KG" icon={<Activity/>}/></div><section className="panel"><div className="panel-head"><div><h3>Fabric stock breakdown</h3><p>Latest reported quantities</p></div></div><div className="table-wrap"><table><thead><tr><th>Category</th><th>MTR</th><th>KG</th><th>Rolls</th></tr></thead><tbody>{items.map(s=><tr key={s.category}><td><b>{s.category}</b></td><td>{number(s.mtr)}</td><td>{number(s.kg,2)}</td><td>{number(s.rolls)}</td></tr>)}</tbody></table></div></section><section className="panel"><h3>Yarn stock reconciliation</h3><DataRows rows={[["APM yarn stock",`${number(r.apmYarnKg,2)} KG`],["SAP yarn stock",`${number(r.sapYarnKg,2)} KG`],["Difference",`${number(r.apmYarnKg-r.sapYarnKg,2)} KG`]]}/></section></>;
}

function SettingsPage() {
  return <><PageTitle title="Settings" subtitle="Application configuration and deployment information."/><section className="panel settings-panel"><h3>Application mode</h3><div className="settings-row"><span>Database connection</span><b className={isSupabaseConfigured?"text-green":"text-orange"}>{isSupabaseConfigured?"Supabase connected":"Local demo mode"}</b></div><div className="settings-row"><span>Authentication</span><b>{isSupabaseConfigured?"Supabase Auth":"Demo role preview"}</b></div><div className="settings-row"><span>Application version</span><b>1.0.0</b></div><div className="notice notice-warning">Local demo mode stores data only in this browser. Configure Supabase before sharing the website with your boss or using it for live reporting.</div></section></>;
}

function Login({onDemoLogin}:{onDemoLogin:()=>void}) {
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);

  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();
    setError("");
    if(!supabase){onDemoLogin();return;}
    setBusy(true);
    const {error:loginError}=await supabase.auth.signInWithPassword({email,password});
    setBusy(false);
    if(loginError)setError(loginError.message);
    // On success, App's onAuthStateChange handler loads the real profile role.
  };

  return <div className="login-screen"><div className="login-stage"><form className="login-card" onSubmit={submit}>
    <div className="brand-icon large"><Activity/></div>
    <h1>Warp Knitting Report</h1>
    <p>Sign in to your production reporting workspace.</p>
    {isSupabaseConfigured?<>
      <Field label="Email address" value={email} type="email" onChange={setEmail}/>
      <label className="field"><span>Password</span><input type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password"/></label>
      {error&&<div className="notice notice-error">{error}</div>}
      <button className="btn btn-primary full" type="submit" disabled={busy}>{busy?"Signing in…":"Sign in"}</button>
    </>:<>
      <div className="notice notice-warning">Demo mode is active. No Supabase credentials are configured.</div>
      <button className="btn btn-primary full" type="submit">Enter demo workspace</button>
    </>}
  </form><footer className="login-attribution"><span className="attribution-line"/><span className="attribution-copy">Developed by</span><strong>MD ASHIQ SHAHARIAR</strong><span className="attribution-mark">KPP <i>·</i> WARP KNITTING</span></footer></div></div>;
}

function RestrictedPage({role}:{role:Role}) {
  return <div className="panel restricted-panel">
    <h2>Access restricted</h2>
    <p>Your account role ({role}) does not have permission to access the reporting workspace.</p>
    <p>Please contact the application administrator if you need access.</p>
  </div>;
}

function RoleGuard({role,allowed,children}:{role:Role;allowed:Role[];children:ReactNode}) {
  if(!allowed.includes(role)) return <Navigate to="/restricted" replace/>;
  return <>{children}</>;
}

export default function App() {
  const [role,setRole]=useState<Role>("user");
  const [authenticated,setAuthenticated]=useState(!isSupabaseConfigured);
  const [authLoading,setAuthLoading]=useState(isSupabaseConfigured);
  const [authError,setAuthError]=useState("");
  const [userEmail,setUserEmail]=useState<string|null>(null);
  const navigate=useNavigate();
  const location=useLocation();
  const {reports,loading,error,refresh,setReports}=useReports(
    authenticated && !authLoading,
    location.key,
    location.pathname,
    location.search
  );

  const loadProfileRole=useCallback(async(userId:string,email?:string|null)=>{
    if(!supabase) return;
    const {data,error:profileError}=await supabase
      .from("profiles")
      .select("role")
      .eq("id",userId)
      .maybeSingle();
    if(profileError) {
      setRole("user");
      setAuthError(`Could not load your account role: ${profileError.message}`);
      return;
    }
    const actualRole=data?.role;
    if(actualRole==="admin" || actualRole==="boss" || actualRole==="user") {
      setRole(actualRole);
      setAuthError("");
    } else {
      setRole("user");
      setAuthError("Your account has no valid application role. Ask an administrator to set profiles.role to admin, boss, or user.");
    }
    setUserEmail(email ?? null);
  },[]);

  useEffect(()=>{
    if(!supabase) { setAuthLoading(false); return; }
    let alive=true;
    const applySession=async(session: import("@supabase/supabase-js").Session|null)=>{
      if(!alive)return;
      if(!session) {
        setAuthenticated(false);
        setRole("user");
        setUserEmail(null);
        setAuthError("");
        setAuthLoading(false);
        setReports([]);
        return;
      }
      setAuthenticated(true);
      setUserEmail(session.user.email??null);
      await loadProfileRole(session.user.id,session.user.email);
      if(alive)setAuthLoading(false);
    };

    supabase.auth.getSession().then(({data,error:sessionError})=>{
      if(sessionError) setAuthError(sessionError.message);
      void applySession(data.session);
    }).catch((e:unknown)=>{
      if(alive) {
        setAuthError(e instanceof Error?e.message:"Unable to read Supabase session.");
        setAuthenticated(false);
        setAuthLoading(false);
      }
    });

    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{
      if(event==="SIGNED_OUT") {
        setAuthenticated(false);
        setRole("user");
        setUserEmail(null);
        setAuthError("");
        setReports([]);
        setAuthLoading(false);
        return;
      }
      if(session) {
        setAuthLoading(true);
        setAuthenticated(true);
        setUserEmail(session.user.email??null);
        // Defer profile lookup outside the auth callback to avoid blocking Supabase's auth lock.
        Promise.resolve()
          .then(()=>loadProfileRole(session.user.id,session.user.email))
          .catch((e:unknown)=>setAuthError(e instanceof Error?e.message:"Unable to load your account role."))
          .finally(()=>setAuthLoading(false));
      }
    });
    return ()=>{alive=false;subscription.unsubscribe();};
  },[loadProfileRole,setReports]);

  const handleSignOut=async()=>{
    try {
      if(supabase) await supabase.auth.signOut({scope:"local"});
    } catch {
      // Best-effort logout: local UI state is cleared even if the network call fails.
    } finally {
      setAuthenticated(false);
      setRole("user");
      setUserEmail(null);
      setReports([]);
      setAuthError("");
      navigate("/login",{replace:true});
    }
  };

  if(supabaseConfigError)return <div className="login-screen"><div className="login-card"><h1>Supabase configuration issue</h1><div className="notice notice-error">{supabaseConfigError}</div></div></div>;
  if(authLoading)return <div className="loading-screen">Loading secure workspace…</div>;
  if(!authenticated)return <Login onDemoLogin={()=>{setRole("admin");setAuthenticated(true);navigate("/",{replace:true});}}/>;

  return <Shell role={role} setRole={r=>{if(!isSupabaseConfigured)setRole(r);}} onSignOut={handleSignOut} userEmail={userEmail}>
    {authError&&<div className="notice notice-error">{authError}</div>}
    {error&&<div className="notice notice-error">{error} <button className="btn btn-secondary btn-small" onClick={()=>void refresh()}>Retry</button></div>}
    <Routes>
      <Route path="/" element={role==="user"?<Navigate to="/restricted" replace/>:<Dashboard reports={reports} loading={loading} role={role}/>}/>
      <Route path="/import" element={<RoleGuard role={role} allowed={["admin"]}><ExcelImport role={role} onImported={onSaved=>setReports(old=>[onSaved,...old.filter(x=>x.reportingDate!==onSaved.reportingDate)])}/></RoleGuard>}/>
      <Route path="/reports/new" element={<RoleGuard role={role} allowed={["admin"]}><ReportEditor role={role} onSaved={r=>{setReports(old=>[r,...old.filter(x=>x.reportingDate!==r.reportingDate)]);navigate(`/reports/${r.id}`);}}/></RoleGuard>}/>
      <Route path="/reports/:id/edit" element={<RoleGuard role={role} allowed={["admin"]}><EditRoute reports={reports} role={role} onSaved={r=>setReports(old=>[r,...old.filter(x=>x.reportingDate!==r.reportingDate)])}/></RoleGuard>}/>
      <Route path="/reports/:id" element={<RoleGuard role={role} allowed={["admin","boss"]}><ReportDetail reports={reports} role={role} onRefresh={()=>void refresh()} onSaved={r=>setReports(old=>[r,...old.filter(x=>x.reportingDate!==r.reportingDate)])}/></RoleGuard>}/>
      <Route path="/history" element={<RoleGuard role={role} allowed={["admin","boss"]}><HistoryPage reports={reports}/></RoleGuard>}/>
      <Route path="/analytics" element={<RoleGuard role={role} allowed={["admin","boss"]}><Analytics key={location.key} reports={reports}/></RoleGuard>}/>
      <Route path="/stock" element={<RoleGuard role={role} allowed={["admin","boss"]}><StockPage reports={reports}/></RoleGuard>}/>
      <Route path="/settings" element={<RoleGuard role={role} allowed={["admin"]}><SettingsPage/></RoleGuard>}/>
      <Route path="/restricted" element={<RestrictedPage role={role}/>}/>
      <Route path="/login" element={<Navigate to={role==="user"?"/restricted":"/"} replace/>}/>
      <Route path="*" element={<Navigate to="/" replace/>}/>
    </Routes>
  </Shell>;
}

function EditRoute({reports,role,onSaved}:{reports:Report[];role:Role;onSaved:(r:Report)=>void}) {
  const {id}=useParams();const report=reports.find(r=>r.id===id);
  return report?<ReportEditor existing={report} role={role} onSaved={onSaved}/>:<div className="empty-state">Report not found.</div>;
}
