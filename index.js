// import express from "express";
const express = require("express");
require("dotenv").config();
const cors = require("cors");
const multer = require("multer");
const upload = multer();
const fs = require("fs");
const path = require("path");
const VAULT_TOKEN = fs.readFileSync("/vault/secrets/token", "utf8").trim();

// const VAULT_TOKEN = process.env.VAULT_TOKEN;
const VAULT_ADDR = "http://vault.vault.svc.cluster.local:8200";
const app = express();
app.use(
  cors({
    origin: function (origin, callback) {
      console.log(origin);

      // Allow requests from nginx container
      const allowedOrigins = [
        "https://nginx", // nginx container name
        "http://localhost:5173",
        "https://127.0.0.1",
      ];

      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.use(
  "/api/downloads",
  express.static(path.join(__dirname, "downloads"), {
    setHeaders: (res, filePath) => {
      if (path.extname(filePath) === ".exe") {
        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${path.basename(filePath)}"`
        );
      }
    },
  })
);
app.get("/api/", (req, res) => {
  res.send("Hello World");
});
app.get("/api/vault/get-otp", async (req, res) => {
  const vaultRes = await fetch(`${VAULT_ADDR}/v1/totp/code/master-node`, {
    headers: {
      "X-Vault-Token": VAULT_TOKEN,
    },
  });
  if (!vaultRes.ok) {
    return res.send("Vault error", { status: 500 });
  }

  const data = await vaultRes.json();

  return res.json({ code: data.data.code });
});

app.post("/api/vault/sign/pubkey", upload.single("file"), async (req, res) => {
  try {
    const pubkey = req.file.buffer.toString("utf8");
    console.log(pubkey);

    const parseData = JSON.parse(req.body.data);
    const totpRes = await fetch(`${VAULT_ADDR}/v1/totp/code/master-node`, {
      headers: {
        "X-Vault-Token": VAULT_TOKEN,
      },
    });
    if (!totpRes.ok) {
      return res.send("Vault error", { status: 500 });
    }
    const totp = await totpRes.json();
    const code = parseInt(totp.data.code);

    if (parseData.otp != code) {
      return res.status(403).json({ error: "Unauthorize" });
    } else {
      const vaultRes = await fetch(`${VAULT_ADDR}/v1/ssh/sign/tarchunk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Vault-Token": VAULT_TOKEN,
        },
        body: JSON.stringify({
          public_key: pubkey,
          format: "openssh",
        }),
      });

      if (!vaultRes.ok) {
        const error = await vaultRes.text();
        return res.status(500).json({ message: "Internal Error", error });
      } else {
        const data = await vaultRes.json();
        res.setHeader("Content-Type", "application/x-openssh-key");
        res.setHeader(
          "Content-Disposition",
          'attachment; filename="signed_key.pub"'
        );
        res.send(data.data.signed_key);
      }
    }
  } catch (err) {
    console.error("Request error:", err);
    return res.send("Internal error", { status: 500 });
  }
});
app.get("/api/download/clientssh", (req, res) => {
  const filePath = path.join(__dirname, "downloads", "clientssh.exe");

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }

  // Set headers for download
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="clientssh.exe"`);

  // Stream the file
  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);

  fileStream.on("error", (error) => {
    console.error("Error streaming file:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Error streaming file" });
    }
  });
});
app.listen(3000);
