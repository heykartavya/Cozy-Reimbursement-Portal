import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    let serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    
    if (typeof serviceAccount === 'string') {
      serviceAccount = JSON.parse(serviceAccount);
    }

    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log("Firebase Admin initialized successfully.");
    }
  } catch (e: any) {
    console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:", e.message);
  }
} else {
  console.warn("FIREBASE_SERVICE_ACCOUNT_JSON not found.");
}

const firestoreDb = admin.apps.length ? admin.firestore() : null;

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || "465"),
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const app = express();
app.use(express.json());

app.post("/api/claims", async (req, res) => {
  try {
    if (!firestoreDb) {
      return res.status(503).json({ 
        error: "Database not initialized. Please check your FIREBASE_SERVICE_ACCOUNT_JSON." 
      });
    }
    const claim = {
      ...req.body,
      status: "Pending",
      submissionDate: new Date().toISOString(),
    };
    
    const docRef = await firestoreDb.collection("claims").add(claim);
    
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
      console.log("Email configuration missing, skipping notification.");
    }
    
    res.status(201).json({ id: docRef.id, ...claim });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/claims", async (req, res) => {
  try {
    if (!firestoreDb) return res.json([]);
    const snapshot = await firestoreDb.collection("claims").orderBy("submissionDate", "desc").get();
    const claims = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(claims);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.patch("/api/claims/:id", async (req, res) => {
  try {
    if (!firestoreDb) throw new Error("Database not initialized");
    const { id } = req.params;
    const { status } = req.body;
    
    const docRef = firestoreDb.collection("claims").doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) return res.status(404).json({ error: "Claim not found" });
    
    const claimData = doc.data();
    await docRef.update({ status });

    if (status === "Paid") {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: "Neil@cozyfarms.in", 
        subject: `Reimbursement Paid: ₹${claimData?.amount}`,
        html: `
          <h3>Your Reimbursement has been Paid</h3>
          <p>Hi ${claimData?.submitterName},</p>
          <p>Your claim for <strong>${claimData?.category}</strong> amounting to <strong>₹${claimData?.amount}</strong> has been marked as <strong>Paid</strong>.</p>
          <p>Reason: ${claimData?.reason}</p>
        `,
      };
    }

    res.json({ id, status });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/manual-spends", async (req, res) => {
  try {
    if (!firestoreDb) return res.json([]);
    const snapshot = await firestoreDb.collection("manual_spends").get();
    const spends = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(spends);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/manual-spends", async (req, res) => {
  try {
    if (!firestoreDb) throw new Error("Database not initialized");
    const spend = {
      ...req.body,
      date: new Date().toISOString(),
    };
    const docRef = await firestoreDb.collection("manual_spends").add(spend);
    res.status(201).json({ id: docRef.id, ...spend });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/manual-spends/:id", async (req, res) => {
  try {
    if (!firestoreDb) throw new Error("Database not initialized");
    await firestoreDb.collection("manual_spends").doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default app;
