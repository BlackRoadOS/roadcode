
var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/worker.js
var AGENTS = [
  // Compute fleet — real hardware, task-capable
  { id: "alice", name: "Alice", specialty: "Infrastructure & Routing", color: "#FF1D6C", type: "compute", ip: "192.168.4.49" },
  { id: "cecilia", name: "Cecilia", specialty: "AI & Machine Learning", color: "#F5A623", type: "compute", ip: "192.168.4.96" },
  { id: "octavia", name: "Octavia", specialty: "DevOps & Containers", color: "#9C27B0", type: "compute", ip: "192.168.4.101" },
  { id: "aria", name: "Aria", specialty: "Monitoring & Analytics", color: "#2979FF", type: "compute", ip: "192.168.4.98" },
  { id: "lucidia", name: "Lucidia", specialty: "Web & Frontend", color: "#00E676", type: "compute", ip: "192.168.4.38" },
  { id: "gematria", name: "Gematria", specialty: "Edge & TLS", color: "#FF1D6C", type: "compute", ip: "159.65.43.12" },
  { id: "anastasia", name: "Anastasia", specialty: "Edge Relay", color: "#F5A623", type: "compute", ip: "174.138.44.45" },
  // IoT devices — observable, reportable
  { id: "alexandria", name: "Alexandria", specialty: "Workstation", color: "#FF1D6C", type: "iot", ip: "192.168.4.28" },
  { id: "eero", name: "Eero", specialty: "Network", color: "#2979FF", type: "iot", ip: "192.168.4.1" },
  { id: "ophelia", name: "Ophelia", specialty: "Observation", color: "#9C27B0", type: "iot", ip: "192.168.4.22" },
  { id: "athena", name: "Athena", specialty: "Media", color: "#F5A623", type: "iot", ip: "192.168.4.27" },
  { id: "cadence", name: "Cadence", specialty: "Streaming", color: "#2979FF", type: "iot", ip: "192.168.4.33" },
  { id: "gaia", name: "Gaia", specialty: "Mobile", color: "#00E676", type: "iot", ip: "192.168.4.44" },
  { id: "olympia", name: "Olympia", specialty: "Mobile", color: "#9C27B0", type: "iot", ip: "192.168.4.45" },
  { id: "thalia", name: "Thalia", specialty: "IoT", color: "#FF1D6C", type: "iot", ip: "192.168.4.53" },
  { id: "portia", name: "Portia", specialty: "IoT", color: "#F5A623", type: "iot", ip: "192.168.4.90" },
  { id: "magnolia", name: "Magnolia", specialty: "IoT", color: "#2979FF", type: "iot", ip: "192.168.4.99" }
];
function secureCors(request) {
  const origin = request?.headers?.get("Origin") || "";
  const allowed = origin.endsWith(".blackroad.io") || origin === "https://blackroad.io" || origin === "http://localhost:8787";
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "https://blackroad.io",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Key",
    "Access-Control-Max-Age": "86400"
  };
}
__name(secureCors, "secureCors");
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const p = url.pathname;
    const cors = secureCors(request);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    try {
      await initDB(env.DB);
      if (p === "/api/health") return json({ status: "ok", service: "RoadCode", agents: AGENTS.length, version: "1.0.0" }, cors);
      if (p === "/api/agents") return json({ agents: AGENTS }, cors);
      if (p === "/api/tasks" && request.method === "GET") return json(await getTasks(env.DB, url), cors);
      if (p === "/api/tasks" && request.method === "POST") {
        const body = await request.json();
        return json(await createTask(env.DB, env.AI, body), cors, 201);
      }
      const taskMatch = p.match(/^\/api\/tasks\/([^/]+)$/);
      if (taskMatch && request.method === "GET") return json(await getTask(env.DB, taskMatch[1]), cors);
      if (taskMatch && request.method === "PUT") {
        const body = await request.json();
        return json(await updateTask(env.DB, taskMatch[1], body), cors);
      }
      const subMatch = p.match(/^\/api\/tasks\/([^/]+)\/subtasks$/);
      if (subMatch && request.method === "GET") return json(await getSubtasks(env.DB, subMatch[1]), cors);
      if (p === "/api/deploy" && request.method === "POST") {
        const body = await request.json();
        return json(await deployTask(env.DB, env.AI, body), cors, 201);
      }
      if (p === "/api/leaderboard") return json(await getLeaderboard(env.DB), cors);
      if (p === "/api/stats") return json(await getStats(env.DB), cors);
      return new Response(HTML, { headers: { ...cors, "Content-Type": "text/html; charset=utf-8" } });
    } catch (e) {
      return json({ error: e.message }, cors, 500);
    }
  }
};
function json(data, cors, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
__name(json, "json");
function uid() {
  return crypto.randomUUID().slice(0, 8);
}
__name(uid, "uid");
async function initDB(db) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS rc_tasks (
      id TEXT PRIMARY KEY, parent_id TEXT, title TEXT NOT NULL, description TEXT,
      status TEXT DEFAULT 'pending', priority TEXT DEFAULT 'normal',
      assigned_to TEXT, tags TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS rc_task_log (
      id TEXT PRIMARY KEY, task_id TEXT NOT NULL, action TEXT NOT NULL,
      agent_id TEXT, detail TEXT, created_at TEXT DEFAULT (datetime('now'))
    )`)
  ]);
}
__name(initDB, "initDB");
async function getTasks(db, url) {
  const status = url.searchParams.get("status");
  const agent = url.searchParams.get("agent");
  const search = url.searchParams.get("q");
  let q = "SELECT * FROM rc_tasks WHERE parent_id IS NULL";
  const binds = [];
  if (status) {
    q += " AND status = ?";
    binds.push(status);
  }
  if (agent) {
    q += " AND assigned_to = ?";
    binds.push(agent);
  }
  if (search) {
    q += " AND (title LIKE ? OR description LIKE ?)";
    binds.push(`%${search}%`, `%${search}%`);
  }
  q += ' ORDER BY CASE priority WHEN "critical" THEN 0 WHEN "high" THEN 1 WHEN "normal" THEN 2 WHEN "low" THEN 3 END, created_at DESC LIMIT 100';
  const stmt = db.prepare(q);
  const r = await (binds.length ? stmt.bind(...binds) : stmt).all();
  return { tasks: r.results || [] };
}
__name(getTasks, "getTasks");
async function getTask(db, id) {
  const task = await db.prepare("SELECT * FROM rc_tasks WHERE id = ?").bind(id).first();
  if (!task) throw new Error("task not found");
  const subs = await db.prepare("SELECT * FROM rc_tasks WHERE parent_id = ? ORDER BY created_at").bind(id).all();
  const log = await db.prepare("SELECT * FROM rc_task_log WHERE task_id = ? ORDER BY created_at DESC LIMIT 20").bind(id).all();
  return { task, subtasks: subs.results || [], log: log.results || [] };
}
__name(getTask, "getTask");
async function createTask(db, ai, { title, description, priority, tags, assigned_to }) {
  if (!title) throw new Error("title required");
  const id = uid();
  const agent = assigned_to || pickAgent(title + " " + (description || ""));
  await db.prepare("INSERT INTO rc_tasks (id, title, description, priority, assigned_to, tags) VALUES (?,?,?,?,?,?)").bind(id, title, description || "", priority || "normal", agent, JSON.stringify(tags || [])).run();
  await logAction(db, id, "created", agent, `Task created and assigned to ${agent}`);
  return { id, title, assigned_to: agent, status: "pending" };
}
__name(createTask, "createTask");
async function updateTask(db, id, { status, assigned_to }) {
  const task = await db.prepare("SELECT * FROM rc_tasks WHERE id = ?").bind(id).first();
  if (!task) throw new Error("task not found");
  if (status) {
    const completed = status === "completed" ? ", completed_at = datetime('now')" : "";
    await db.prepare(`UPDATE rc_tasks SET status = ?, updated_at = datetime('now')${completed} WHERE id = ?`).bind(status, id).run();
    await logAction(db, id, status, task.assigned_to, `Status changed to ${status}`);
  }
  if (assigned_to) {
    await db.prepare('UPDATE rc_tasks SET assigned_to = ?, updated_at = datetime("now") WHERE id = ?').bind(assigned_to, id).run();
    await logAction(db, id, "reassigned", assigned_to, `Reassigned to ${assigned_to}`);
  }
  return { ok: true };
}
__name(updateTask, "updateTask");
async function getSubtasks(db, parentId) {
  const r = await db.prepare("SELECT * FROM rc_tasks WHERE parent_id = ? ORDER BY created_at").bind(parentId).all();
  return { subtasks: r.results || [] };
}
__name(getSubtasks, "getSubtasks");
async function deployTask(db, ai, { title, description, priority }) {
  if (!title) throw new Error("title required");
  const id = uid();
  const lead = pickAgent(title + " " + (description || ""));
  await db.prepare("INSERT INTO rc_tasks (id, title, description, priority, assigned_to, status) VALUES (?,?,?,?,?,?)").bind(id, title, description || "", priority || "high", lead, "in_progress").run();
  await logAction(db, id, "deployed", lead, "Task deployed — breaking into subtasks");
  let subtasks = [];
  try {
    const r = await ai.run("@cf/meta/llama-3.1-8b-instruct", {
      messages: [
        { role: "system", content: 'You break tasks into 2-4 subtasks. Return ONLY a JSON array of objects with "title" and "specialist" (one of: atlas, alice, cecilia, octavia, lucidia, cipher, shellfish, echo, oracle, scout). No explanation.' },
        { role: "user", content: `Break this task into subtasks:
Title: ${title}
Description: ${description || title}` }
      ],
      max_tokens: 300
    });
    if (r?.response) {
      const match = r.response.match(/\[[\s\S]*\]/);
      if (match) subtasks = JSON.parse(match[0]);
    }
  } catch {
  }
  if (subtasks.length === 0) {
    subtasks = [
      { title: `Research: ${title}`, specialist: "oracle" },
      { title: `Implement: ${title}`, specialist: lead },
      { title: `Test: ${title}`, specialist: "scout" }
    ];
  }
  const created = [];
  for (const st of subtasks.slice(0, 5)) {
    const sid = uid();
    const agent = st.specialist || pickAgent(st.title);
    await db.prepare("INSERT INTO rc_tasks (id, parent_id, title, priority, assigned_to, status) VALUES (?,?,?,?,?,?)").bind(sid, id, st.title, priority || "normal", agent, "pending").run();
    await logAction(db, sid, "created", agent, `Subtask deployed under ${id}`);
    created.push({ id: sid, title: st.title, assigned_to: agent });
  }
  return { id, title, lead, status: "in_progress", subtasks: created };
}
__name(deployTask, "deployTask");
async function getLeaderboard(db) {
  const r = await db.prepare(`SELECT assigned_to as agent, COUNT(*) as total,
    SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed,
    SUM(CASE WHEN status='in_progress' THEN 1 ELSE 0 END) as active
    FROM rc_tasks WHERE assigned_to IS NOT NULL GROUP BY assigned_to ORDER BY completed DESC`).all();
  return { leaderboard: r.results || [] };
}
__name(getLeaderboard, "getLeaderboard");
async function getStats(db) {
  const total = await db.prepare("SELECT COUNT(*) as c FROM rc_tasks").first();
  const active = await db.prepare("SELECT COUNT(*) as c FROM rc_tasks WHERE status='in_progress'").first();
  const completed = await db.prepare("SELECT COUNT(*) as c FROM rc_tasks WHERE status='completed'").first();
  const pending = await db.prepare("SELECT COUNT(*) as c FROM rc_tasks WHERE status='pending'").first();
  return { total: total?.c || 0, active: active?.c || 0, completed: completed?.c || 0, pending: pending?.c || 0, agents: AGENTS.length };
}
__name(getStats, "getStats");
async function logAction(db, taskId, action, agentId, detail) {
  await db.prepare("INSERT INTO rc_task_log (id, task_id, action, agent_id, detail) VALUES (?,?,?,?,?)").bind(uid(), taskId, action, agentId || "", detail || "").run();
}
__name(logAction, "logAction");
function pickAgent(text) {
  const t = text.toLowerCase();
  if (/infra|route|network|dns|nginx/.test(t)) return "alice";
  if (/ai|ml|model|train|llm/.test(t)) return "cecilia";
  if (/deploy|docker|container|devops/.test(t)) return "octavia";
  if (/web|frontend|ui|html|css/.test(t)) return "lucidia";
  if (/security|encrypt|auth|cert/.test(t)) return "cipher";
  if (/script|shell|automat|cron/.test(t)) return "shellfish";
  if (/test|qa|check|verify/.test(t)) return "scout";
  if (/research|search|find|docs/.test(t)) return "oracle";
  if (/message|chat|notify|alert/.test(t)) return "echo";
  return "atlas";
}
__name(pickAgent, "pickAgent");
var HTML = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>RoadCode -- Dev Dashboard | BlackRoad OS</title>
<meta name="description" content="RoadCode dev dashboard -- repo browser, task deployment, fleet status, and scaffolding.">
<meta property="og:title" content="RoadCode -- Dev Dashboard | BlackRoad OS">
<meta property="og:description" content="Dev dashboard with repo browser, task deployment, fleet status, and scaffolding.">
<meta property="og:url" content="https://roadcode.blackroad.io">
<meta property="og:type" content="website">
<meta property="og:image" content="https://images.blackroad.io/pixel-art/road-logo.png">
<meta name="twitter:card" content="summary">
<link rel="canonical" href="https://roadcode.blackroad.io/">
<meta name="robots" content="index, follow">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebApplication","name":"RoadCode","url":"https://roadcode.blackroad.io","applicationCategory":"DeveloperApplication","operatingSystem":"Web","description":"Dev dashboard with repo browser, task deployment, fleet status","author":{"@type":"Organization","name":"BlackRoad OS, Inc."}}<\/script>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=Inter:wght@400;500&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--pink:#FF1D6C;--amber:#F5A623;--blue:#2979FF;--violet:#9C27B0;--green:#00E676;--bg:#0a0a0a;--surface:#111;--border:#1a1a1a;--text:#e5e5e5;--dim:#a3a3a3;--muted:#525252}
body{background:var(--bg);color:var(--text);font-family:'Inter',sans-serif;min-height:100vh;padding-top:48px}
h1,h2,h3{font-family:'Space Grotesk',sans-serif;font-weight:600;color:var(--text)}
code,.mono{font-family:'JetBrains Mono',monospace}
#br-nav{position:fixed;top:0;left:0;right:0;z-index:9999;background:rgba(10,10,10,0.94);backdrop-filter:blur(12px);border-bottom:1px solid var(--border);font-family:'Space Grotesk',-apple-system,sans-serif}
#br-nav .ni{max-width:1200px;margin:0 auto;padding:0 20px;height:48px;display:flex;align-items:center;justify-content:space-between}
#br-nav .nl{display:flex;align-items:center;gap:12px}
#br-nav .nb{color:var(--muted);font-size:12px;padding:6px 8px;border-radius:6px;display:flex;align-items:center;cursor:pointer;border:none;background:none;transition:color .15s}
#br-nav .nb:hover{color:var(--text)}
#br-nav .nh{text-decoration:none;display:flex;align-items:center;gap:8px}
#br-nav .nm{display:flex;gap:2px}#br-nav .nm span{width:6px;height:6px;border-radius:50%}
#br-nav .nt{color:var(--text);font-weight:600;font-size:14px}
#br-nav .ns{color:#333;font-size:14px}#br-nav .np{color:var(--dim);font-size:13px}
#br-nav .nk{display:flex;align-items:center;gap:4px;overflow-x:auto;scrollbar-width:none}
#br-nav .nk::-webkit-scrollbar{display:none}
#br-nav .nk a{color:var(--dim);text-decoration:none;font-size:12px;padding:6px 10px;border-radius:6px;white-space:nowrap;transition:color .15s,background .15s}
#br-nav .nk a:hover{color:var(--text);background:var(--surface)}
#br-nav .nk a.ac{color:var(--text);background:#1a1a1a}
#br-nav .mm{display:none;background:none;border:none;color:var(--dim);font-size:20px;cursor:pointer;padding:6px}
#br-dd{display:none;position:fixed;top:48px;left:0;right:0;background:rgba(10,10,10,0.96);backdrop-filter:blur(12px);border-bottom:1px solid var(--border);z-index:9998;padding:12px 20px}
#br-dd.open{display:flex;flex-wrap:wrap;gap:4px}
#br-dd a{color:var(--dim);text-decoration:none;font-size:13px;padding:8px 14px;border-radius:6px;transition:color .15s,background .15s}
#br-dd a:hover,#br-dd a.ac{color:var(--text);background:var(--surface)}
.page{max-width:1200px;margin:0 auto;padding:20px}
.hdr{display:flex;align-items:center;gap:16px;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--border)}
.hdr-mark{width:44px;height:44px;border-radius:10px;background:linear-gradient(135deg,var(--pink),var(--blue));flex-shrink:0}
.hdr h1{font-size:24px}.hdr-sub{color:var(--dim);font-size:13px;margin-top:2px}
.stats-bar{display:flex;gap:1px;background:var(--border);border-radius:8px;overflow:hidden;margin-bottom:20px}
.sb{flex:1;background:var(--surface);padding:14px 10px;text-align:center}
.sb-n{font-family:'Space Grotesk',sans-serif;font-size:20px;font-weight:700;color:var(--text)}
.sb-l{font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-top:2px}
.tabs{display:flex;gap:2px;margin-bottom:20px;border-bottom:1px solid var(--border)}
.tab{padding:10px 16px;font-size:13px;color:var(--dim);cursor:pointer;border-bottom:2px solid transparent;transition:color .15s,border-color .15s;font-family:'Space Grotesk',sans-serif;font-weight:500;background:none;border-top:none;border-left:none;border-right:none}
.tab:hover{color:var(--text)}.tab.active{color:var(--text);border-bottom-color:var(--pink)}
.panel{display:none}.panel.active{display:block}
.search-bar{display:flex;gap:8px;margin-bottom:16px}
.search-input{flex:1;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 14px;color:var(--text);font-size:13px;font-family:'Inter',sans-serif;outline:none}
.search-input:focus{border-color:#333}.search-input::placeholder{color:var(--muted)}
.search-btn{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 20px;color:var(--text);font-size:13px;cursor:pointer;font-family:'Space Grotesk',sans-serif;font-weight:600}
.search-btn:hover{background:#1a1a1a}
.repo-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px}
.repo-card{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px;cursor:pointer;transition:border-color .2s}
.repo-card:hover{border-color:#262626}
.repo-name{font-size:14px;font-weight:600;color:var(--text);margin-bottom:4px;font-family:'Space Grotesk',sans-serif}
.repo-desc{font-size:11px;color:var(--dim);line-height:1.4;margin-bottom:8px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.repo-meta{display:flex;gap:12px;font-size:10px;color:var(--muted);font-family:'JetBrains Mono',monospace;align-items:center}
.repo-meta .rdot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.fleet-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}
.fleet-card{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px}
.fc-top{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.fc-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.fc-name{font-size:14px;font-weight:600;color:var(--text)}
.fc-ip{font-size:10px;color:var(--muted);font-family:'JetBrains Mono',monospace;margin-left:auto}
.fc-role{font-size:11px;color:var(--dim);margin-bottom:4px}
.fc-services{font-size:10px;color:var(--muted);font-family:'JetBrains Mono',monospace;line-height:1.5}
.cmd-list{display:flex;flex-direction:column;gap:4px}
.cmd-item{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 14px;display:flex;align-items:center;gap:10px}
.cmd-prompt{color:var(--muted);font-size:11px;font-family:'JetBrains Mono',monospace;flex-shrink:0}
.cmd-text{font-size:12px;color:var(--text);font-family:'JetBrains Mono',monospace;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cmd-agent{font-size:10px;color:var(--dim);flex-shrink:0}
.cmd-time{font-size:10px;color:var(--muted);font-family:'JetBrains Mono',monospace;flex-shrink:0}
.deploy-form{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:16px}
.deploy-form h3{font-size:14px;margin-bottom:12px}
.df-input{width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);padding:8px 12px;border-radius:6px;font-size:12px;font-family:'Inter',sans-serif;margin-bottom:8px;outline:none}
.df-input:focus{border-color:#333}
.df-textarea{width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);padding:8px 12px;border-radius:6px;font-size:12px;font-family:'Inter',sans-serif;min-height:50px;resize:vertical;margin-bottom:8px;outline:none}
.df-row{display:flex;gap:8px;margin-bottom:8px}
.df-select{background:var(--bg);border:1px solid var(--border);color:var(--text);padding:8px 12px;border-radius:6px;font-size:12px;font-family:'Inter',sans-serif;outline:none;flex:1}
.df-btns{display:flex;gap:8px}
.btn{padding:8px 16px;border:none;border-radius:6px;font-weight:600;cursor:pointer;font-size:12px;font-family:'Space Grotesk',sans-serif}
.btn-deploy{background:var(--pink);color:#fff;flex:1}
.btn-create{background:var(--surface);border:1px solid var(--border);color:var(--text);flex:1}
.btn:disabled{opacity:0.5}
.tasks-list{display:flex;flex-direction:column;gap:8px}
.task-card{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px 14px;cursor:pointer;transition:border-color .2s}
.task-card:hover{border-color:#262626}
.tc-head{display:flex;align-items:center;gap:8px;margin-bottom:4px}
.tc-title{font-size:13px;font-weight:500;flex:1;color:var(--text)}
.pill{font-size:9px;padding:2px 8px;border-radius:12px;font-weight:600;text-transform:uppercase;font-family:'JetBrains Mono',monospace}
.pill-pending{border:1px solid var(--amber);color:var(--amber)}
.pill-in_progress{border:1px solid var(--blue);color:var(--blue)}
.pill-completed{border:1px solid var(--green);color:var(--green)}
.pill-failed{border:1px solid var(--pink);color:var(--pink)}
.tc-meta{font-size:10px;color:var(--muted);display:flex;gap:12px;font-family:'JetBrains Mono',monospace}
.priority-critical{border-left:3px solid var(--pink)}.priority-high{border-left:3px solid var(--amber)}
.filters{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap}
.filter{padding:6px 12px;border:1px solid var(--border);border-radius:16px;font-size:11px;cursor:pointer;background:transparent;color:var(--dim);font-family:'Inter',sans-serif}
.filter:hover{color:var(--text)}.filter.active{border-color:var(--pink);color:var(--text)}
.ly{display:flex;gap:20px}.ly-main{flex:1;min-width:0}.ly-side{width:240px;flex-shrink:0}
.section-title{font-family:'Space Grotesk',sans-serif;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;margin-top:16px}
.agent-row{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;margin-bottom:2px}
.agent-row:hover{background:var(--surface)}
.ar-dot{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#0a0a0a;flex-shrink:0}
.ar-name{font-size:12px;font-weight:500;color:var(--text)}.ar-spec{font-size:10px;color:var(--muted)}
.lb-row{display:flex;justify-content:space-between;font-size:11px;padding:4px 8px;border-bottom:1px solid var(--border)}
.lb-name{font-weight:500;color:var(--text)}.lb-score{font-family:'JetBrains Mono',monospace;color:var(--dim)}
.tpl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}
.tpl-card{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px;cursor:pointer;transition:border-color .2s}
.tpl-card:hover{border-color:#262626}
.tpl-icon{width:36px;height:36px;border-radius:8px;margin-bottom:8px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#0a0a0a}
.tpl-name{font-size:13px;font-weight:600;color:var(--text);margin-bottom:2px}
.tpl-desc{font-size:11px;color:var(--muted);line-height:1.4}
.modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:100;align-items:center;justify-content:center}
.modal.show{display:flex}
.modal-content{background:var(--surface);border:1px solid var(--border);border-radius:12px;max-width:600px;width:90%;max-height:80vh;overflow-y:auto;padding:20px}
.modal-content h2{font-family:'Space Grotesk',sans-serif;margin-bottom:12px}
.modal-close{float:right;background:none;border:none;color:var(--muted);font-size:18px;cursor:pointer}
.log-entry{font-size:11px;padding:4px 0;border-bottom:1px solid var(--border);display:flex;gap:8px}
.log-entry .time{color:var(--muted);font-family:'JetBrains Mono',monospace;font-size:10px;flex-shrink:0}
.sub{display:flex;align-items:center;gap:6px;font-size:11px;padding:4px 0}
.sub .dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.empty{text-align:center;padding:40px;color:var(--muted)}.empty h3{color:var(--text);margin-bottom:4px}
::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#222;border-radius:3px}
@media(max-width:768px){#br-nav .nk{display:none}#br-nav .mm{display:block}.ly-side{display:none}.ly{flex-direction:column}.repo-grid{grid-template-columns:1fr}.fleet-grid{grid-template-columns:1fr}.tpl-grid{grid-template-columns:repeat(auto-fill,minmax(160px,1fr))}}
</style></head><body>
<nav id="br-nav"><div class="ni"><div class="nl"><button class="nb" onclick="history.length>1?history.back():location.href='https://blackroad.io'" title="Back">&larr;</button><a href="https://blackroad.io" class="nh"><div class="nm"><span style="background:#FF6B2B"></span><span style="background:#FF2255"></span><span style="background:#CC00AA"></span><span style="background:#8844FF"></span><span style="background:#4488FF"></span><span style="background:#00D4FF"></span></div><span class="nt">BlackRoad</span></a><span class="ns">/</span><span class="np">RoadCode</span></div><div class="nk"><a href="https://blackroad.io">Home</a><a href="https://chat.blackroad.io">Chat</a><a href="https://search.blackroad.io">Search</a><a href="https://tutor.blackroad.io">Tutor</a><a href="https://pay.blackroad.io">Pay</a><a href="https://canvas.blackroad.io">Canvas</a><a href="https://cadence.blackroad.io">Cadence</a><a href="https://video.blackroad.io">Video</a><a href="https://radio.blackroad.io">Radio</a><a href="https://game.blackroad.io">Game</a><a href="https://roadtrip.blackroad.io">Agents</a><a href="https://roadcode.blackroad.io" class="ac">RoadCode</a><a href="https://hq.blackroad.io">HQ</a><a href="https://app.blackroad.io">Dashboard</a></div><button class="mm" onclick="document.getElementById('br-dd').classList.toggle('open')">&#9776;</button></div></nav>
<div id="br-dd"><a href="https://blackroad.io">Home</a><a href="https://chat.blackroad.io">Chat</a><a href="https://search.blackroad.io">Search</a><a href="https://tutor.blackroad.io">Tutor</a><a href="https://pay.blackroad.io">Pay</a><a href="https://canvas.blackroad.io">Canvas</a><a href="https://cadence.blackroad.io">Cadence</a><a href="https://video.blackroad.io">Video</a><a href="https://radio.blackroad.io">Radio</a><a href="https://game.blackroad.io">Game</a><a href="https://roadtrip.blackroad.io">Agents</a><a href="https://roadcode.blackroad.io" class="ac">RoadCode</a><a href="https://hq.blackroad.io">HQ</a><a href="https://app.blackroad.io">Dashboard</a></div>
<script>document.addEventListener('click',function(e){var d=document.getElementById('br-dd');if(d&&d.classList.contains('open')&&!e.target.closest('#br-nav')&&!e.target.closest('#br-dd'))d.classList.remove('open')});<\/script>

<div class="page">
<div class="hdr"><div class="hdr-mark"></div><div><h1>RoadCode</h1><div class="hdr-sub">Dev dashboard -- repos, tasks, fleet status, and scaffolding</div></div></div>

<div class="stats-bar">
<div class="sb"><div class="sb-n" id="sbTasks">--</div><div class="sb-l">Tasks</div></div>
<div class="sb"><div class="sb-n" id="sbActive">--</div><div class="sb-l">Active</div></div>
<div class="sb"><div class="sb-n" id="sbDone">--</div><div class="sb-l">Done</div></div>
<div class="sb"><div class="sb-n" id="sbAgents">--</div><div class="sb-l">Agents</div></div>
</div>

<div class="tabs">
<button class="tab active" onclick="switchTab('tasks')">Tasks</button>
<button class="tab" onclick="switchTab('repos')">Repos</button>
<button class="tab" onclick="switchTab('fleet')">Fleet</button>
<button class="tab" onclick="switchTab('history')">History</button>
<button class="tab" onclick="switchTab('templates')">Templates</button>
</div>

<div class="panel active" id="panel-tasks">
<div class="ly">
<div class="ly-main">
<div class="deploy-form">
<h3>Deploy Task</h3>
<input class="df-input" id="taskTitle" placeholder="Task title..." autocomplete="off">
<textarea class="df-textarea" id="taskDesc" placeholder="Description (optional)..."></textarea>
<div class="df-row"><select class="df-select" id="taskPriority"><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option><option value="low">Low</option></select></div>
<div class="df-btns"><button class="btn btn-create" onclick="submitTask('create')">Create Task</button><button class="btn btn-deploy" onclick="submitTask('deploy')">Deploy (auto-break)</button></div>
</div>
<div class="filters"><button class="filter active" onclick="filterTasks('')">All</button><button class="filter" onclick="filterTasks('pending')">Pending</button><button class="filter" onclick="filterTasks('in_progress')">Active</button><button class="filter" onclick="filterTasks('completed')">Completed</button></div>
<div class="tasks-list" id="tasksList"></div>
</div>
<div class="ly-side">
<div class="section-title">Agent Roster</div><div id="agentRoster"></div>
<div class="section-title">Leaderboard</div><div id="leaderboard"></div>
</div>
</div>
</div>

<div class="panel" id="panel-repos">
<div class="search-bar"><input class="search-input" id="repoSearch" placeholder="Search repos by name..." autocomplete="off"><button class="search-btn" onclick="searchRepos()">Search</button></div>
<div class="repo-grid" id="repoGrid"><div class="empty"><h3>Loading repos...</h3></div></div>
</div>

<div class="panel" id="panel-fleet"><div class="fleet-grid" id="fleetGrid"></div></div>
<div class="panel" id="panel-history"><div class="cmd-list" id="cmdList"></div></div>
<div class="panel" id="panel-templates"><div class="tpl-grid" id="tplGrid"></div></div>
</div>

<div class="modal" id="taskModal" onclick="if(event.target===this)closeModal()"><div class="modal-content" id="modalContent"></div></div>

<script>
var tasks=[],agents=[],currentFilter='';
var COLORS={alice:'#FF1D6C',cecilia:'#F5A623',aria:'#2979FF',octavia:'#9C27B0',lucidia:'#00E676',gematria:'#FF1D6C',anastasia:'#F5A623',cipher:'#FF1D6C',shellfish:'#F5A623',echo:'#2979FF',oracle:'#9C27B0',scout:'#00E676',atlas:'#2979FF',alexandria:'#FF1D6C'};

function switchTab(name){
  document.querySelectorAll('.tab').forEach(function(t){t.classList.toggle('active',t.textContent.toLowerCase()===name)});
  document.querySelectorAll('.panel').forEach(function(p){p.classList.toggle('active',p.id==='panel-'+name)});
}

async function init(){
  try{
    var results=await Promise.all([fetch('/api/agents'),fetch('/api/tasks'),fetch('/api/stats'),fetch('/api/leaderboard')]);
    agents=(await results[0].json()).agents||[];
    tasks=(await results[1].json()).tasks||[];
    var stats=await results[2].json();
    var lb=await results[3].json();
    document.getElementById('sbTasks').textContent=stats.total||0;
    document.getElementById('sbActive').textContent=stats.active||0;
    document.getElementById('sbDone').textContent=stats.completed||0;
    document.getElementById('sbAgents').textContent=stats.agents||agents.length;
    document.getElementById('agentRoster').innerHTML=agents.filter(function(a){return a.type==='compute'}).map(function(a){return '<div class="agent-row"><div class="ar-dot" style="background:'+a.color+'">'+(a.name||'')[0]+'</div><div><div class="ar-name">'+a.name+'</div><div class="ar-spec">'+a.specialty+'</div></div></div>'}).join('');
    document.getElementById('leaderboard').innerHTML=(lb.leaderboard||[]).map(function(l){return '<div class="lb-row"><span class="lb-name">'+l.agent+'</span><span class="lb-score">'+l.completed+'/'+l.total+'</span></div>'}).join('')||'<div style="color:var(--muted);font-size:11px;padding:4px 8px">No tasks yet</div>';
    renderTasks();
  }catch(e){console.error(e)}
  renderFleet();renderRepos('');renderHistory();renderTemplates();
}

function renderTasks(){
  var filtered=currentFilter?tasks.filter(function(t){return t.status===currentFilter}):tasks;
  var el=document.getElementById('tasksList');
  if(!filtered.length){el.innerHTML='<div class="empty"><h3>No tasks</h3><p style="font-size:12px;color:var(--muted)">Deploy a task to get started.</p></div>';return}
  el.innerHTML=filtered.map(function(t){return '<div class="task-card priority-'+(t.priority||'')+'" onclick="showTask(''+t.id+'')"><div class="tc-head"><span class="tc-title">'+esc(t.title)+'</span><span class="pill pill-'+t.status+'">'+t.status+'</span></div><div class="tc-meta"><span>'+(t.assigned_to||'unassigned')+'</span><span>'+t.priority+'</span><span>'+new Date(t.created_at).toLocaleDateString()+'</span></div></div>'}).join('');
}

function filterTasks(s){
  currentFilter=s;
  document.querySelectorAll('.filter').forEach(function(f){f.classList.toggle('active',f.textContent.toLowerCase().includes(s)||(!s&&f.textContent==='All'))});
  renderTasks();
}

async function submitTask(mode){
  var title=document.getElementById('taskTitle').value.trim();
  if(!title)return;
  var desc=document.getElementById('taskDesc').value.trim();
  var priority=document.getElementById('taskPriority').value;
  var endpoint=mode==='deploy'?'/api/deploy':'/api/tasks';
  try{
    var r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:title,description:desc,priority:priority})});
    var d=await r.json();
    document.getElementById('taskTitle').value='';document.getElementById('taskDesc').value='';
    var tr2=await fetch('/api/tasks');tasks=(await tr2.json()).tasks||[];renderTasks();
    if(mode==='deploy'&&d.subtasks)showTask(d.id);
  }catch(e){}
}

async function showTask(id){
  try{
    var r=await fetch('/api/tasks/'+id);var d=await r.json();var t=d.task;
    document.getElementById('modalContent').innerHTML='<button class="modal-close" onclick="closeModal()">&times;</button><h2>'+esc(t.title)+'</h2><p style="color:var(--dim);margin-bottom:12px;font-size:12px">'+esc(t.description||'No description')+'</p><div style="display:flex;gap:12px;margin-bottom:12px"><span class="pill pill-'+t.status+'">'+t.status+'</span><span style="font-size:11px;color:var(--muted)">Assigned: '+(t.assigned_to||'none')+'</span><span style="font-size:11px;color:var(--muted)">Priority: '+t.priority+'</span></div>'+(d.subtasks&&d.subtasks.length?'<div class="section-title">Subtasks</div>'+d.subtasks.map(function(s){return '<div class="sub"><div class="dot" style="background:'+(COLORS[s.assigned_to]||'#525252')+'"></div><span>'+esc(s.title)+'</span><span class="pill pill-'+s.status+'" style="font-size:8px">'+s.status+'</span><button class="btn" style="padding:2px 8px;font-size:10px;background:var(--surface);border:1px solid var(--border);color:var(--text)" onclick="completeTask(''+s.id+'')">Done</button></div>'}).join(''):'')+'<div class="section-title">Activity Log</div>'+(d.log||[]).map(function(l){return '<div class="log-entry"><span class="time">'+new Date(l.created_at).toLocaleTimeString()+'</span><span>'+l.agent_id+': '+esc(l.detail)+'</span></div>'}).join('')+'<div style="margin-top:12px">'+(t.status!=='completed'?'<button class="btn btn-deploy" onclick="completeTask(''+t.id+'')">Mark Complete</button>':'')+'</div>';
    document.getElementById('taskModal').classList.add('show');
  }catch(e){}
}

async function completeTask(id){
  await fetch('/api/tasks/'+id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'completed'})});
  closeModal();var tr=await fetch('/api/tasks');tasks=(await tr.json()).tasks||[];renderTasks();
}
function closeModal(){document.getElementById('taskModal').classList.remove('show')}

var defaultRepos=[
  {name:'RoadCode',desc:'Gitea self-hosted Git -- 239 repos mirrored from GitHub',lang:'Go',color:'#2979FF'},
  {name:'TollBooth',desc:'WireGuard mesh VPN -- 12/12 node connections',lang:'Go',color:'#00E676'},
  {name:'PitStop',desc:'Pi-hole DNS filtering and ad blocking',lang:'Shell',color:'#FF1D6C'},
  {name:'Passenger',desc:'Ollama local LLM inference across fleet',lang:'Go',color:'#F5A623'},
  {name:'OneWay',desc:'Caddy TLS reverse proxy -- 151 domains',lang:'Go',color:'#2979FF'},
  {name:'RearView',desc:'Qdrant vector database for RAG search',lang:'Rust',color:'#9C27B0'},
  {name:'Curb',desc:'MinIO S3-compatible object storage',lang:'Go',color:'#FF1D6C'},
  {name:'RoundAbout',desc:'Headscale mesh coordination',lang:'Go',color:'#00E676'},
  {name:'CarPool',desc:'NATS messaging -- pub/sub for agent communication',lang:'Go',color:'#F5A623'},
  {name:'OverPass',desc:'n8n workflow automation',lang:'TypeScript',color:'#2979FF'},
  {name:'BackRoad',desc:'Portainer container management',lang:'Go',color:'#9C27B0'},
  {name:'RoadMap',desc:'Grafana observability dashboards',lang:'TypeScript',color:'#F5A623'}
];
function renderRepos(filter){
  var items=filter?defaultRepos.filter(function(r){return r.name.toLowerCase().includes(filter.toLowerCase())||r.desc.toLowerCase().includes(filter.toLowerCase())}):defaultRepos;
  document.getElementById('repoGrid').innerHTML=items.map(function(r){
    return '<div class="repo-card"><div class="repo-name">'+r.name+'</div><div class="repo-desc">'+r.desc+'</div><div class="repo-meta"><span class="rdot" style="background:'+r.color+'"></span>'+r.lang+'</div></div>';
  }).join('')||(filter?'<div class="empty"><h3>No repos matching "'+esc(filter)+'"</h3></div>':'');
}
function searchRepos(){renderRepos(document.getElementById('repoSearch').value.trim())}
document.getElementById('repoSearch').onkeydown=function(e){if(e.key==='Enter')searchRepos()};
document.getElementById('repoSearch').oninput=function(){renderRepos(this.value.trim())};

function renderFleet(){
  var nodes=agents.length?agents.filter(function(a){return a.type==='compute'}):
    [{name:'Alice',specialty:'Infrastructure',color:'#FF1D6C',ip:'192.168.4.49'},
     {name:'Cecilia',specialty:'AI/ML',color:'#F5A623',ip:'192.168.4.96'},
     {name:'Octavia',specialty:'DevOps',color:'#9C27B0',ip:'192.168.4.101'},
     {name:'Aria',specialty:'Monitoring',color:'#2979FF',ip:'192.168.4.98'},
     {name:'Lucidia',specialty:'Web',color:'#00E676',ip:'192.168.4.38'},
     {name:'Gematria',specialty:'Edge/TLS',color:'#FF1D6C',ip:'159.65.43.12'},
     {name:'Anastasia',specialty:'Relay',color:'#F5A623',ip:'174.138.44.45'}];
  document.getElementById('fleetGrid').innerHTML=nodes.map(function(n){
    return '<div class="fleet-card"><div class="fc-top"><div class="fc-dot" style="background:'+n.color+'"></div><span class="fc-name">'+n.name+'</span><span class="fc-ip">'+(n.ip||'')+'</span></div><div class="fc-role">'+(n.specialty||n.role||'')+'</div></div>';
  }).join('');
}

function renderHistory(){
  var cmds=[
    {cmd:'wrangler deploy --name hq-blackroad',agent:'lucidia',time:'2m ago'},
    {cmd:'git push origin main --all',agent:'octavia',time:'5m ago'},
    {cmd:'ollama run llama3.1:8b',agent:'cecilia',time:'8m ago'},
    {cmd:'caddy reload --config /etc/caddy/Caddyfile',agent:'gematria',time:'12m ago'},
    {cmd:'systemctl restart nginx',agent:'alice',time:'15m ago'},
    {cmd:'docker compose up -d',agent:'octavia',time:'22m ago'},
    {cmd:'npm run build && npm run deploy',agent:'lucidia',time:'30m ago'},
    {cmd:'pg_dump blackroad > backup.sql',agent:'alice',time:'45m ago'},
    {cmd:'nats pub fleet.status "all-clear"',agent:'aria',time:'1h ago'},
    {cmd:'minio mc mirror local/assets r2/assets',agent:'cecilia',time:'1h ago'}
  ];
  document.getElementById('cmdList').innerHTML=cmds.map(function(c){
    return '<div class="cmd-item"><span class="cmd-prompt">$</span><span class="cmd-text">'+esc(c.cmd)+'</span><span class="cmd-agent" style="color:'+(COLORS[c.agent]||'var(--dim)')+'">'+c.agent+'</span><span class="cmd-time">'+c.time+'</span></div>';
  }).join('');
}

function renderTemplates(){
  var tpls=[
    {name:'CF Worker',desc:'Cloudflare Worker with D1, KV, and routing',color:'var(--blue)',icon:'W'},
    {name:'Pi Service',desc:'Systemd service for Raspberry Pi fleet',color:'var(--green)',icon:'Pi'},
    {name:'API Route',desc:'REST API with auth, rate limiting, CORS',color:'var(--pink)',icon:'A'},
    {name:'Agent Config',desc:'Agent manifest with roles and capabilities',color:'var(--violet)',icon:'Ag'},
    {name:'Docker Stack',desc:'Docker Compose with health checks and volumes',color:'var(--amber)',icon:'D'},
    {name:'Cron Job',desc:'Scheduled task with logging and alerts',color:'var(--blue)',icon:'C'},
    {name:'DNS Zone',desc:'PowerDNS zone with CNAME and A records',color:'var(--green)',icon:'Z'},
    {name:'TLS Cert',desc:'Caddy auto-TLS with Lets Encrypt',color:'var(--pink)',icon:'T'}
  ];
  document.getElementById('tplGrid').innerHTML=tpls.map(function(t){
    return '<div class="tpl-card"><div class="tpl-icon" style="background:'+t.color+'">'+t.icon+'</div><div class="tpl-name">'+t.name+'</div><div class="tpl-desc">'+t.desc+'</div></div>';
  }).join('');
}

function esc(s){return(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}

init();setInterval(async function(){try{var r=await fetch('/api/tasks');tasks=(await r.json()).tasks||[];renderTasks()}catch(e){}},15000);
<\/script></body></html>`;
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map

