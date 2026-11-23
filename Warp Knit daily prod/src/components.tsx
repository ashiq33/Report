import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { Activity, BarChart3, FilePlus2, FileSpreadsheet, Factory, History, LayoutDashboard, LogOut, Settings, ShieldCheck, Warehouse, Menu, X } from "lucide-react";
import type { Role } from "./types";

const nav = [
  {to:"/", label:"Dashboard", icon:LayoutDashboard},
  {to:"/import", label:"Excel Import", icon:FileSpreadsheet},
  {to:"/reports/new", label:"Create Report", icon:FilePlus2, admin:true},
  {to:"/analytics", label:"Analytics", icon:BarChart3},
  {to:"/stock", label:"Stock Overview", icon:Warehouse},
  {to:"/history", label:"Report History", icon:History},
  {to:"/settings", label:"Settings", icon:Settings, admin:true},
  {to:"/restricted", label:"Access status", icon:ShieldCheck, user:true}
];

export function Shell({children, role, setRole, onSignOut, userEmail}: {children:ReactNode; role:Role; setRole:(r:Role)=>void; onSignOut:()=>void; userEmail:string|null}) {
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-icon"><Factory size={21}/></div><div><strong>WARP KNITTING</strong><small>DAILY REPORTING</small></div></div>
      <div className="nav-label">WORKSPACE</div>
      <nav>{nav.filter(n=>role==="user" ? Boolean(n.user) : !n.user && (!n.admin || role==="admin")).map(item=><NavLink key={item.to} to={item.to} end={item.to==="/"} className={({isActive})=>`nav-item ${isActive?"active":""}`}><item.icon size={18}/><span>{item.label}</span></NavLink>)}</nav>
      <div className="sidebar-bottom">
        <div className="role-card"><ShieldCheck size={18}/><div><b>{role==="admin"?"Administrator":role==="boss"?"Management Viewer":"Restricted user"}</b><small>{role==="admin"?"Full reporting access":role==="boss"?"Read-only access":"Limited access"}</small></div></div>
        {(!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) && <><label className="role-switch">Preview role<select value={role} onChange={e=>setRole(e.target.value as Role)}><option value="admin">Admin</option><option value="boss">Boss / Viewer</option></select></label><small className="muted">Demo role switch is for local preview only.</small></>}
      </div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div><span className="eyebrow">PRODUCTION MANAGEMENT</span><h2>Warp Knitting Report</h2></div><div className="top-actions"><span className="online-dot"/> <span className="muted">{userEmail??"Reporting workspace"}</span><div className="avatar">{role==="admin"?"A":role==="boss"?"B":"U"}</div><button className="btn btn-secondary btn-small sign-out-btn" onClick={onSignOut}><LogOut size={15}/> Sign Out</button></div></header>
      <div className="page-content">{children}</div>
      <footer className="footer">Developed by MD ASHIQ SHAHARIAR <span>Internal reporting application</span></footer>
    </main>
  </div>;
}

export function PageTitle({title, subtitle, action}:{title:string;subtitle:string;action?:ReactNode}) {
  return <div className="page-title"><div><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>;
}
export function StatCard({label,value,unit,change,icon,tone="blue"}:{label:string;value:string;unit?:string;change?:string;icon:ReactNode;tone?:string}) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><div className="stat-label">{label}</div><div className="stat-value">{value}<small>{unit}</small></div>{change&&<div className="stat-change">{change}</div>}</div>;
}
