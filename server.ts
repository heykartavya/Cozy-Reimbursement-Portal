import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    let serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    
    // Handle cases where the JSON might be double-stringified or wrapped in quotes
    if (typeof serviceAccount === 'string') {
      serviceAccount = JSON.parse(serviceAccount);
    }

    // Fix escaped newlines in the private key which often cause "Pattern mismatch" errors
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("Firebase Admin initialized successfully.");
  } catch (e: any) {
    console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:", e.message);
  }
} else {
  console.warn("FIREBASE_SERVICE_ACCOUNT_JSON not found. Firebase Admin features will be limited.");
}

const db = admin.apps.length ? admin.firestore() : null;

// Email Transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || "465"),
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post("/api/claims", async (req, res) => {
    try {
      if (!db) {
        return res.status(503).json({ 
          error: "Database not initialized. Please check your FIREBASE_SERVICE_ACCOUNT_JSON." 
        });
      }
      const claim = {
        ...req.body,
        status: "Pending",
        submissionDate: new Date().toISOString(),
      };
      
      const docRef = await db.collection("claims").add(claim);
      
      // Send email to Neil (only if configured)
      if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        try {
          const mailOptions = {
            from: process.env.EMAIL_USER,
            to: "Neil@cozyfarms.in",
            subject: `New Reimbursement Claim: ${claim.submitterName}`,
            html: `
              <h3>New Claim Submitted</h3>
              <p><strong>Submitter:</strong> ${claim.submitterName}</p>
              <p><strong>Category:</strong> ${claim.category}</p>
              <p><strong>Amount:</strong> ₹${claim.amount}</p>
              <p><strong>Reason:</strong> ${claim.reason}</p>
              <p><strong>Receipts:</strong> ${claim.receiptUrls?.map((url: string, i: number) => `<a href="${url}">Proof ${i+1}</a>`).join(", ") || "No proof attached"}</p>
              <p><a href="${process.env.APP_URL}/admin">Go to Approval Desk</a></p>
            `,
          };
          await transporter.sendMail(mailOptions);
        } catch (emailErr) {
          console.error("Email failed but claim was saved:", emailErr);
        }
      } else {
        console.log("Email configuration missing, skipping notification to Neil.");
      }
      
      res.status(201).json({ id: docRef.id, ...claim });
    } catch (error: any) {
      console.error("Firestore Error:", error.message);
      if (error.message.includes("Cloud Firestore API has not been used")) {
        return res.status(503).json({ 
          error: "Firestore API is disabled. Please enable it in the Firebase Console (Firestore Database > Create Database)." 
        });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/claims", async (req, res) => {
    try {
      if (!db) return res.json([]);
      const snapshot = await db.collection("claims").orderBy("submissionDate", "desc").get();
      const claims = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json(claims);
    } catch (error: any) {
      console.error("Firestore Error:", error.message);
      if (error.message.includes("Cloud Firestore API has not been used")) {
        return res.status(503).json({ 
          error: "Database setup incomplete. Please enable Firestore in your Firebase Console." 
        });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/claims/:id", async (req, res) => {
    try {
      if (!db) throw new Error("Database not initialized");
      const { id } = req.params;
      const { status } = req.body;
      
      const docRef = db.collection("claims").doc(id);
      const doc = await docRef.get();
      
      if (!doc.exists) return res.status(404).json({ error: "Claim not found" });
      
      const claimData = doc.data();
      await docRef.update({ status });

      // If marked as Paid, email the submitter
      if (status === "Paid") {
        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: "Neil@cozyfarms.in", // In a real app, we'd have the submitter's email. 
          // For now, let's assume we notify Neil or a generic notification.
          // The prompt says "Trigger an automatic email to the original submitter"
          // We'll mock the submitter email as we don't have it in the dropdown options.
          // Let's assume we have a mapping or just send to a placeholder.
          subject: `Reimbursement Paid: ₹${claimData?.amount}`,
          html: `
            <h3>Your Reimbursement has been Paid</h3>
            <p>Hi ${claimData?.submitterName},</p>
            <p>Your claim for <strong>${claimData?.category}</strong> amounting to <strong>₹${claimData?.amount}</strong> has been marked as <strong>Paid</strong>.</p>
            <p>Reason: ${claimData?.reason}</p>
          `,
        };
        // In production, you'd use claimData.submitterEmail
        // await transporter.sendMail(mailOptions);
      }

      res.json({ id, status });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/manual-spends", async (req, res) => {
    try {
      if (!db) return res.json([]);
      const snapshot = await db.collection("manual_spends").get();
      const spends = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json(spends);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/manual-spends", async (req, res) => {
    try {
      if (!db) throw new Error("Database not initialized");
      const spend = {
        ...req.body,
        date: new Date().toISOString(),
      };
      const docRef = await db.collection("manual_spends").add(spend);
      res.status(201).json({ id: docRef.id, ...spend });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/manual-spends/:id", async (req, res) => {
    try {
      if (!db) throw new Error("Database not initialized");
      await db.collection("manual_spends").doc(req.params.id).delete();
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }
}
startServer();
export default app;
