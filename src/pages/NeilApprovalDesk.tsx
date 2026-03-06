import React, { useState, useEffect } from "react";
import { formatDate } from "../lib/utils";
import { CheckCircle, CreditCard, ExternalLink, Download, Search, Filter, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";

interface Claim {
  id: string;
  submitterName: string;
  category: string;
  amount: number;
  reason: string;
  receiptUrl: string;
  receiptUrls?: string[];
  submissionDate: string;
  status: "Pending" | "Approved" | "Paid";
}

export default function NeilApprovalDesk() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchClaims();
  }, []);

  const fetchClaims = async () => {
    try {
      const res = await fetch("/api/claims");
      const data = await res.json();
      setClaims(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      setClaims([]);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/claims/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setClaims(prev => prev.map(c => c.id === id ? { ...c, status: status as any } : c));
      }
    } catch (error) {
      console.error(error);
    }
  };

  const exportToExcel = () => {
    const filtered = (claims || []).filter(c => {
      const date = new Date(c.submissionDate);
      const start = dateRange.start ? new Date(dateRange.start) : null;
      const end = dateRange.end ? new Date(dateRange.end) : null;
      return (!start || date >= start) && (!end || date <= end);
    });

    const worksheet = XLSX.utils.json_to_sheet(filtered);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Claims");
    XLSX.writeFile(workbook, `CozyFarms_Claims_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const filteredClaims = (claims || []).filter(c => 
    c.submitterName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.reason.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto py-12 px-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Neil's Approval Desk</h1>
          <p className="text-slate-600">Manage and process reimbursement requests.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5">
            <Filter className="w-4 h-4 text-slate-400" />
            <input 
              type="date" 
              className="text-sm outline-none" 
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            />
            <span className="text-slate-300">to</span>
            <input 
              type="date" 
              className="text-sm outline-none" 
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            />
          </div>
          <button 
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
          >
            <Download className="w-4 h-4" /> Export Excel
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-bottom border-slate-100 bg-slate-50/50 flex items-center gap-3">
          <Search className="w-5 h-5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search by name, category, or reason..."
            className="bg-transparent outline-none w-full text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Submitter</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Details</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
                  </td>
                </tr>
              ) : filteredClaims.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">No requests found.</td>
                </tr>
              ) : filteredClaims.map((claim) => (
                <tr key={claim.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{claim.submitterName}</div>
                    <div className="text-xs text-slate-500">{claim.category}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-slate-600 line-clamp-1 max-w-xs">{claim.reason}</div>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {claim.receiptUrls && claim.receiptUrls.length > 0 ? (
                        claim.receiptUrls.map((url, i) => (
                          <a 
                            key={i}
                            href={url} 
                            target="_blank" 
                            rel="noreferrer"
                            className="text-indigo-600 text-xs hover:underline flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" /> Proof {i + 1}
                          </a>
                        ))
                      ) : claim.receiptUrl ? (
                        <a 
                          href={claim.receiptUrl} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-indigo-600 text-xs hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" /> View Receipt
                        </a>
                      ) : (
                        <span className="text-slate-400 text-xs italic">No proof</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-900">₹{claim.amount}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                      ${claim.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' : 
                        claim.status === 'Approved' ? 'bg-blue-100 text-blue-800' : 
                        'bg-amber-100 text-amber-800'}`}>
                      {claim.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">{formatDate(claim.submissionDate)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <select 
                        value={claim.status}
                        onChange={(e) => updateStatus(claim.id, e.target.value)}
                        className="text-xs border border-slate-200 rounded px-2 py-1 outline-none bg-white hover:border-slate-300 transition-colors"
                      >
                        <option value="Pending">Pending</option>
                        <option value="Approved">Approved</option>
                        <option value="Paid">Paid</option>
                      </select>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full text-[10px] font-medium text-slate-500 uppercase tracking-wider">
          <div className={`w-1.5 h-1.5 rounded-full ${claims.length > 0 ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
          Database Connection: {claims.length > 0 ? 'Active' : 'Checking...'}
        </div>
      </div>
    </div>
  );
}
