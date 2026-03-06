import React, { useState, useEffect } from "react";
import { SUBMITTERS, CATEGORIES } from "../lib/utils";
import { suggestCategory } from "../services/gemini";
import { Upload, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function ClaimPortal() {
  const [formData, setFormData] = useState({
    submitterName: "",
    category: "",
    amount: "",
    reason: "",
    receiptUrls: [] as string[],
  });
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [aiSuggesting, setAiSuggesting] = useState(false);

  useEffect(() => {
    console.log("ClaimPortal mounted. Config Check:");
    console.log("- Firebase API Key:", import.meta.env.VITE_FIREBASE_API_KEY ? "Present" : "Missing");
    console.log("- Firebase Project ID:", import.meta.env.VITE_FIREBASE_PROJECT_ID ? "Present" : "Missing");
    console.log("- Cloudinary Cloud Name:", import.meta.env.VITE_CLOUDINARY_CLOUD_NAME ? "Present" : "Missing");
    console.log("- Cloudinary Upload Preset:", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET ? "Present" : "Missing");
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleAiSuggest = async () => {
    if (!formData.reason) return;
    setAiSuggesting(true);
    const suggestion = await suggestCategory(formData.reason);
    if (suggestion && CATEGORIES.includes(suggestion)) {
      setFormData(prev => ({ ...prev, category: suggestion }));
    }
    setAiSuggesting(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    console.log("Starting submission process...");

    try {
      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
      console.log("Cloudinary Configured:", cloudName && uploadPreset ? "Yes" : "No");
      
      let receiptUrls: string[] = [];

      if (files.length > 0) {
        if (!cloudName || !uploadPreset) {
          throw new Error("Cloudinary is not configured. Please add VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET to your secrets.");
        }

        console.log(`Uploading ${files.length} files to Cloudinary...`);
        const uploadPromises = files.map(async (file, index) => {
          console.log(`Uploading file ${index + 1}: ${file.name} (${file.size} bytes)`);
          
          // Force PDFs and Word docs to be uploaded as "raw" files so they can be downloaded
          // without triggering Cloudinary's default PDF security restrictions.
          const isDocument = file.name.toLowerCase().match(/\.(pdf|doc|docx)$/);
          const resourceType = isDocument ? "raw" : "auto";
          
          const uploadFormData = new FormData();
          uploadFormData.append("file", file);
          uploadFormData.append("upload_preset", uploadPreset);

          try {
            const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
              method: "POST",
              body: uploadFormData,
            });

            if (!response.ok) {
              const err = await response.json();
              throw new Error(err.error?.message || "Failed to upload to Cloudinary");
            }

            const data = await response.json();
            console.log(`File ${index + 1} uploaded successfully.`);
            
            let finalUrl = data.secure_url;
            // Fallback: If it still uploaded as an image (e.g., due to preset overrides) and is a PDF/DOC,
            // force it to download as an attachment to prevent "failed to load" browser errors.
            if (finalUrl.includes("/image/upload/") && isDocument) {
              finalUrl = finalUrl.replace("/upload/", "/upload/fl_attachment/");
            }
            
            return finalUrl;
          } catch (err: any) {
            console.error(`Error uploading ${file.name}:`, err);
            throw err;
          }
        });

        receiptUrls = await Promise.all(uploadPromises);
        console.log("All files uploaded.");
      } else {
        console.log("No files selected, skipping upload.");
      }

      console.log("Sending data to server...");
      
      // Fetch with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, receiptUrls }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      const result = await response.json();
      console.log("Server Response:", response.status, result);

      if (response.ok) {
        setSuccess(true);
        setFormData({
          submitterName: "",
          category: "",
          amount: "",
          reason: "",
          receiptUrls: [],
        });
        setFiles([]);
      } else {
        throw new Error(result.error || "Server failed to process the claim.");
      }
    } catch (error: any) {
      console.error("Detailed Submission Error:", error);
      const msg = error.name === 'AbortError' 
        ? "Server request timed out. Please try again." 
        : (error.message || "Unknown error occurred");
      alert(`Submission Error: ${msg}`);
    } finally {
      setLoading(false);
      console.log("Submission process ended.");
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="bg-emerald-100 p-4 rounded-full mb-4"
        >
          <CheckCircle2 className="w-12 h-12 text-emerald-600" />
        </motion.div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Claim Submitted!</h2>
        <p className="text-slate-600 mb-6">Neil has been notified and will review your request shortly.</p>
        <button
          onClick={() => setSuccess(false)}
          className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          Submit Another
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto py-12 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Reimbursement Portal</h1>
        <p className="text-slate-600">Submit your claims for review by the management.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Your Name</label>
          <select
            required
            className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all"
            value={formData.submitterName}
            onChange={(e) => setFormData({ ...formData, submitterName: e.target.value })}
          >
            <option value="">Select your name</option>
            {SUBMITTERS.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
            <div className="relative">
              <select
                required
                className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all appearance-none"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                <option value="">Select category</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAiSuggest}
                disabled={aiSuggesting || !formData.reason}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-indigo-600 disabled:opacity-50 transition-colors"
                title="Suggest category using AI"
              >
                {aiSuggesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Amount (₹)</label>
            <input
              type="number"
              required
              placeholder="0.00"
              className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Reason / Description</label>
          <textarea
            required
            rows={3}
            placeholder="What was this expense for?"
            className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all"
            value={formData.reason}
            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Receipts / Proofs (Multiple allowed)</label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-lg hover:border-slate-400 transition-colors cursor-pointer relative">
            <div className="space-y-1 text-center">
              <Upload className="mx-auto h-12 w-12 text-slate-400" />
              <div className="flex text-sm text-slate-600">
                <label className="relative cursor-pointer bg-white rounded-md font-medium text-slate-900 hover:text-slate-700 focus-within:outline-none">
                  <span>Upload files</span>
                  <input type="file" className="sr-only" onChange={handleFileChange} accept="image/*,.pdf,.doc,.docx" multiple />
                </label>
                <p className="pl-1">or drag and drop</p>
              </div>
              <p className="text-xs text-slate-500">PNG, JPG, PDF, DOCX up to 10MB each</p>
              
              {files.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2 justify-center">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 bg-slate-100 px-2 py-1 rounded text-xs font-medium text-slate-700">
                      <span className="truncate max-w-[100px]">{f.name}</span>
                      <button type="button" onClick={() => removeFile(i)} className="text-red-500 hover:text-red-700">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : "Submit Claim"}
        </button>
      </form>

      <div className="mt-8 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full text-[10px] font-medium text-slate-500 uppercase tracking-wider">
          <div className={`w-1.5 h-1.5 rounded-full ${import.meta.env.VITE_FIREBASE_PROJECT_ID ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
          Firebase Config: {import.meta.env.VITE_FIREBASE_PROJECT_ID ? 'Loaded' : 'Missing'}
        </div>
      </div>
    </div>
  );
}
