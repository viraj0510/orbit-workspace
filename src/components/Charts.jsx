import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const axisStyle = { fill: '#7e8491', fontSize: 10, fontFamily: 'DM Sans, sans-serif' }
const tooltipStyle = { backgroundColor: '#171a23', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, color: '#e7eaf0', fontSize: 11 }

export function ActivityChart({ data = [] }) {
  return <div className="chart-canvas"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 9, right: 5, left: -19, bottom: 0 }}>
    <defs><linearGradient id="activityGradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#a8df78" stopOpacity={.26} /><stop offset="100%" stopColor="#a8df78" stopOpacity={0} /></linearGradient></defs>
    <CartesianGrid stroke="rgba(255,255,255,.055)" strokeDasharray="3 5" vertical={false} />
    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={axisStyle} dy={8} />
    <YAxis axisLine={false} tickLine={false} tick={axisStyle} />
    <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: 'rgba(255,255,255,.15)' }} />
    <Area type="monotone" dataKey="activity" name="Workspace activity" stroke="#b0e784" strokeWidth={2} fill="url(#activityGradient)" activeDot={{ r: 4, stroke: '#13161d', strokeWidth: 2 }} />
  </AreaChart></ResponsiveContainer></div>
}

export function GrowthChart({ data = [] }) {
  return <div className="chart-canvas admin-chart-canvas"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 10, right: 5, left: -18, bottom: 0 }}>
    <defs><linearGradient id="growthGradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#a8df78" stopOpacity={.24} /><stop offset="100%" stopColor="#a8df78" stopOpacity={0} /></linearGradient></defs>
    <CartesianGrid stroke="rgba(255,255,255,.055)" strokeDasharray="3 5" vertical={false} />
    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={axisStyle} dy={8} />
    <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={axisStyle} />
    <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: 'rgba(255,255,255,.15)' }} />
    <Area type="monotone" dataKey="users" name="New accounts" stroke="#b0e784" strokeWidth={2} fill="url(#growthGradient)" activeDot={{ r: 4, stroke: '#13161d', strokeWidth: 2 }} />
  </AreaChart></ResponsiveContainer></div>
}

export function ProjectDonut({ data = [] }) {
  const colors = ['#a8df78', '#7d9fea', '#d4b47a', '#777b8e']
  const source = data.length ? data : [{ status: 'No projects', count: 1 }]
  return <div className="donut-wrap"><div className="donut-chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={source} dataKey="count" nameKey="status" innerRadius="72%" outerRadius="94%" paddingAngle={3} stroke="none">{source.map((entry, index) => <Cell key={entry.status} fill={data.length ? colors[index % colors.length] : '#3a3e49'} />)}</Pie><Tooltip contentStyle={tooltipStyle} /></PieChart></ResponsiveContainer><div className="donut-chart-center"><strong>{data.reduce((sum, item) => sum + item.count, 0)}</strong><span>projects</span></div></div><div className="donut-legend">{data.map((item, index) => <div key={item.status}><i style={{ background: colors[index % colors.length] }} /><span>{item.status.replace('_', ' ').toLowerCase()}</span><strong>{item.count}</strong></div>)}</div></div>
}
