import React, { useState, useEffect } from "react";
import { 
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line 
} from "recharts";
import { TrendingUp, Clock, CheckCircle, Wallet, BrainCircuit, Loader2, Plus, Trash2, LayoutDashboard } from "lucide-react";
import { analyzeSpendingTrends } from "../services/gemini";
import Markdown from "react-markdown";

const COLORS = [
  "#10b981", // Emerald
  "#6366f1", // Indigo
  "#f43f5e", // Rose
  "#f59e0b", // Amber
  "#06b6d4", // Cyan
  "#8b5cf6", // Violet
  "#ec4899", // Pink
  "#f97316", // Orange
];

interface ManualSpend {
  id: string;
  name: string;
  amount: number;
  category: string;
  date: string;
}

export default function CEODashboard() {
  const [claims, setClaims] = useState<any[]>([]);
  const [manualSpends, setManualSpends] = useState<ManualSpend[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiInsights, setAiInsights] = useState("");
  const [generatingInsights, setGeneratingInsights] = useState(false);
  
  // Manual spend form
  const [showAddSpend, setShowAddSpend] = useState(false);
  const [newSpend, setNewSpend] = useState({ name: "", amount: "", category: "Operations" });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [claimsRes, spendsRes] = await Promise.all([
        fetch("/api/claims"),
        fetch("/api/manual-spends")
      ]);
      
      const claimsData = await claimsRes.json();
      const spendsData = await spendsRes.json();
      
      const claimsArray = Array.isArray(claimsData) ? claimsData : [];
      const spendsArray = Array.isArray(spendsData) ? spendsData : [];
      
      setClaims(claimsArray);
      setManualSpends(spendsArray);
      
      if (claimsArray.length > 0) {
        generateInsights([...claimsArray, ...spendsArray]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const generateInsights = async (data: any[]) => {
    setGeneratingInsights(true);
    const insights = await analyzeSpendingTrends(data);
    setAiInsights(insights || "");
    setGeneratingInsights(false);
  };

  const handleAddManualSpend = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/manual-spends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name: newSpend.name, 
          amount: Number(newSpend.amount), 
          category: newSpend.category 
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setManualSpends([...manualSpends, data]);
        setNewSpend({ name: "", amount: "", category: "Operations" });
        setShowAddSpend(false);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteManualSpend = async (id: string) => {
    try {
      await fetch(`/api/manual-spends/${id}`, { method: "DELETE" });
      setManualSpends(manualSpends.filter(s => s.id !== id));
    } catch (error) {
      console.error(error);
    }
  };

  const safeClaims = Array.isArray(claims) ? claims : [];
  const combinedData = [...safeClaims, ...manualSpends];

  const stats = {
    pending: safeClaims.filter(c => c.status === "Pending").reduce((acc, c) => acc + Number(c.amount), 0),
    paid: safeClaims.filter(c => c.status === "Paid").reduce((acc, c) => acc + Number(c.amount), 0),
    manual: manualSpends.reduce((acc, s) => acc + Number(s.amount), 0),
    total: combinedData.reduce((acc, c) => acc + Number(c.amount), 0),
    monthly: combinedData.filter(c => {
      const date = new Date(c.submissionDate || c.date);
      const now = new Date();
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }).reduce((acc, c) => acc + Number(c.amount), 0),
  };

  const categoryData = combinedData.reduce((acc: any[], item) => {
    const existing = acc.find(i => i.name === item.category);
    if (existing) {
      existing.value += Number(item.amount);
    } else {
      acc.push({ name: item.category, value: Number(item.amount) });
    }
    return acc;
  }, []);

  const monthlyTrends = combinedData.reduce((acc: any[], item) => {
    const date = new Date(item.submissionDate || item.date);
    const month = date.toLocaleString('default', { month: 'short' });
    const year = date.getFullYear();
    const key = `${month} ${year}`;
    
    const existing = acc.find(i => i.key === key);
    if (existing) {
      existing.total += Number(item.amount);
      existing[item.category] = (existing[item.category] || 0) + Number(item.amount);
    } else {
      acc.push({ key, month, year, total: Number(item.amount), [item.category]: Number(item.amount) });
    }
    return acc;
  }, []).sort((a, b) => {
    const dateA = new Date(`${a.month} 1, ${a.year}`);
    const dateB = new Date(`${b.month} 1, ${b.year}`);
    return dateA.getTime() - dateB.getTime();
  });

  return (
    <div className="max-w-7xl mx-auto py-12 px-4">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <LayoutDashboard className="w-8 h-8 text-slate-900" />
            <h1 className="text-3xl font-bold text-slate-900">Founder's Strategic Dashboard</h1>
          </div>
          <p className="text-slate-600">High-level expenditure analysis and financial health.</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Ecosystem Spend</div>
            <div className="text-3xl font-bold text-slate-900">₹{stats.total.toLocaleString()}</div>
          </div>
          <button 
            onClick={() => setShowAddSpend(!showAddSpend)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Add Virtual Spend
          </button>
        </div>
      </div>

      {showAddSpend && (
        <div className="mb-8 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-top-4">
          <h3 className="text-lg font-semibold mb-4">Add Virtual Spend (CEO View Only)</h3>
          <form onSubmit={handleAddManualSpend} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Description</label>
              <input 
                type="text" 
                required
                className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                value={newSpend.name}
                onChange={e => setNewSpend({...newSpend, name: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Amount (₹)</label>
              <input 
                type="number" 
                required
                className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                value={newSpend.amount}
                onChange={e => setNewSpend({...newSpend, amount: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Category</label>
              <select 
                className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                value={newSpend.category}
                onChange={e => setNewSpend({...newSpend, category: e.target.value})}
              >
                <option value="Operations">Operations</option>
                <option value="Marketing">Marketing</option>
                <option value="Travel">Travel</option>
                <option value="Food & Beverage">Food & Beverage</option>
                <option value="Office Supplies">Office Supplies</option>
                <option value="Miscellaneous">Miscellaneous</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700">Save</button>
              <button type="button" onClick={() => setShowAddSpend(false)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
              <Clock className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium text-slate-500">Pending Claims</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">₹{stats.pending.toLocaleString()}</div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
              <CheckCircle className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium text-slate-500">Paid Claims</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">₹{stats.paid.toLocaleString()}</div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium text-slate-500">Monthly Spend</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">₹{stats.monthly.toLocaleString()}</div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-2 bg-rose-50 rounded-lg text-rose-600">
              <Wallet className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium text-slate-500">Virtual Adjustments</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">₹{stats.manual.toLocaleString()}</div>
        </div>
      </div>

      {/* AI Insights */}
      <div className="bg-slate-900 text-white p-8 rounded-2xl mb-8 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <BrainCircuit className="w-6 h-6 text-indigo-400" />
            <h2 className="text-xl font-semibold">Gemini AI Strategic Insights</h2>
          </div>
          {generatingInsights ? (
            <div className="flex items-center gap-3 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Analyzing expenditure patterns...</span>
            </div>
          ) : (
            <div className="prose prose-invert max-w-none text-slate-300">
              <Markdown>{aiInsights}</Markdown>
            </div>
          )}
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-3xl rounded-full -mr-32 -mt-32"></div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-6">Spend Distribution by Category</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => `₹${value.toLocaleString()}`}
                />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-6">Total Monthly Spend Trend</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrends}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="key" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => `₹${value.toLocaleString()}`}
                />
                <Line type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={3} dot={{ r: 6, fill: '#6366f1' }} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900 mb-6">Category Breakdown Over Time</h3>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyTrends}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="key" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }} 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                formatter={(value: number) => `₹${value.toLocaleString()}`}
              />
              <Legend />
              {categoryData.map((cat: any, index: number) => (
                <Bar key={cat.name} dataKey={cat.name} stackId="a" fill={COLORS[index % COLORS.length]} radius={[2, 2, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {manualSpends.length > 0 && (
        <div className="mt-8 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <h3 className="font-semibold text-slate-900">Virtual Adjustments List</h3>
            <span className="text-xs text-slate-500 italic">These do not affect the main claim sheet</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Description</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Category</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Amount</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {manualSpends.map(spend => (
                  <tr key={spend.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{spend.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{spend.category}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">₹{spend.amount.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleDeleteManualSpend(spend.id)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
