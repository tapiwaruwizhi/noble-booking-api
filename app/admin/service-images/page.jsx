"use client";
// src/app/admin/service-images/page.jsx
// Simple admin UI at /admin/service-images to upload appointment-type images.
// Protect this route further (e.g. Vercel password protection or a login check)
// before sharing widely — the /api/admin/service-image route already requires
// ADMIN_UPLOAD_KEY, but don't rely on that alone for a public deployment.

import { useState, useEffect } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

export default function ServiceImagesAdmin() {
  const [services, setServices] = useState([]);
  const [adminKey, setAdminKey] = useState("");
  const [uploading, setUploading] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/api/startup`)
      .then(r => r.json())
      .then(d => setServices(d.appointmentTypes ?? []))
      .catch(() => setMessage("Failed to load services"));
  }, []);

  async function handleUpload(serviceUid, file) {
    if (!adminKey) {
      setMessage("Enter admin key first");
      return;
    }
    setUploading(serviceUid);
    setMessage("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("service_uid", serviceUid);
    formData.append("admin_key", adminKey);

    try {
      const res  = await fetch(`${API_BASE}/api/admin/service-image`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setMessage(`✓ Uploaded for ${serviceUid}`);
    } catch (err) {
      setMessage(`✗ ${err.message}`);
    } finally {
      setUploading(null);
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: "40px auto", fontFamily: "system-ui, sans-serif", padding: "0 16px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Service Images — Admin</h1>
      <p style={{ color: "#666", fontSize: 14, marginBottom: 20 }}>
        Upload an image for each appointment type. Stored in Vercel Blob, not ezyVet.
      </p>

      <input
        type="password"
        placeholder="Admin key"
        value={adminKey}
        onChange={e => setAdminKey(e.target.value)}
        style={{ width: "100%", padding: 10, marginBottom: 20, border: "1px solid #ccc", borderRadius: 8, fontSize: 14 }}
      />

      {message && (
        <div style={{ padding: 10, marginBottom: 16, borderRadius: 8, background: message.startsWith("✓") ? "#E1F5EE" : "#FEE2E2", fontSize: 14 }}>
          {message}
        </div>
      )}

      {services.map(s => (
        <div key={s.uid} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid #eee" }}>
          <div>
            <div style={{ fontWeight: 500 }}>{s.name}</div>
            <div style={{ fontSize: 12, color: "#999" }}>{s.uid}</div>
          </div>
          <label style={{ cursor: "pointer", padding: "8px 14px", background: "#00897B", color: "#fff", borderRadius: 8, fontSize: 13 }}>
            {uploading === s.uid ? "Uploading..." : "Upload image"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: "none" }}
              onChange={e => e.target.files[0] && handleUpload(s.uid, e.target.files[0])}
            />
          </label>
        </div>
      ))}

      {services.length === 0 && <p style={{ color: "#999" }}>Loading services...</p>}
    </div>
  );
}