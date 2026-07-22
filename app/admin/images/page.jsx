"use client";
// src/app/admin/images/page.jsx
// Admin UI at /admin/images to upload branding images for services,
// locations (branches), and doctors (vets). Stored in Vercel Blob.
//
// Protect this route further before sharing widely (e.g. Vercel password
// protection) — the API route requires ADMIN_UPLOAD_KEY but that alone
// shouldn't be the only gate on a public deployment.

import { useState, useEffect } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

const TABS = [
  { key: "service",  label: "Services"  },
  { key: "location", label: "Locations" },
  { key: "doctor",   label: "Doctors"   },
];

export default function ImagesAdmin() {
  const [tab, setTab]           = useState("service");
  const [services, setServices]   = useState([]);
  const [separations, setSeparations] = useState([]);
  const [resources, setResources] = useState([]);
  const [adminKey, setAdminKey] = useState("");
  const [uploading, setUploading] = useState(null);
  const [message, setMessage]   = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/api/startup`)
      .then(r => r.json())
      .then(d => {
        setServices(d.appointmentTypes ?? []);
        setSeparations(d.separations ?? []);
        setResources(d.resources ?? []);
      })
      .catch(() => setMessage("Failed to load data"));
  }, []);

  async function handleUpload(category, itemId, file) {
    if (!adminKey) { setMessage("Enter admin key first"); return; }
    setUploading(`${category}:${itemId}`);
    setMessage("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", category);
    formData.append("item_id", itemId);
    formData.append("admin_key", adminKey);

    try {
      const res  = await fetch(`${API_BASE}/api/admin/upload-image`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setMessage(`✓ Uploaded for ${itemId}`);
    } catch (err) {
      setMessage(`✗ ${err.message}`);
    } finally {
      setUploading(null);
    }
  }

  const listFor = {
    service:  services.map(s => ({ id: s.uid, label: s.name, sub: s.uid })),
    location: separations.map(s => ({ id: s.id, label: s.name, sub: `id: ${s.id}` })),
    doctor:   resources.map(r => ({ id: r.uid, label: r.name, sub: r.separationName })),
  }[tab];

  return (
    <div style={{ maxWidth: 640, margin: "40px auto", fontFamily: "system-ui, sans-serif", padding: "0 16px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Image Uploads — Admin</h1>
      <p style={{ color: "#666", fontSize: 14, marginBottom: 20 }}>
        Upload branding images for services, locations, and doctors. Stored in Vercel Blob.
      </p>

      <input
        type="password"
        placeholder="Admin key"
        value={adminKey}
        onChange={e => setAdminKey(e.target.value)}
        style={{ width: "100%", padding: 10, marginBottom: 16, border: "1px solid #ccc", borderRadius: 8, fontSize: 14 }}
      />

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "8px 16px", borderRadius: 8, fontSize: 13, cursor: "pointer",
              border: tab === t.key ? "1px solid #00897B" : "1px solid #ddd",
              background: tab === t.key ? "#00897B" : "#fff",
              color: tab === t.key ? "#fff" : "#333",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {message && (
        <div style={{ padding: 10, marginBottom: 16, borderRadius: 8, background: message.startsWith("✓") ? "#E1F5EE" : "#FEE2E2", fontSize: 14 }}>
          {message}
        </div>
      )}

      {(listFor ?? []).map(item => (
        <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid #eee" }}>
          <div>
            <div style={{ fontWeight: 500 }}>{item.label}</div>
            <div style={{ fontSize: 12, color: "#999" }}>{item.sub}</div>
          </div>
          <label style={{ cursor: "pointer", padding: "8px 14px", background: "#00897B", color: "#fff", borderRadius: 8, fontSize: 13 }}>
            {uploading === `${tab}:${item.id}` ? "Uploading..." : "Upload image"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: "none" }}
              onChange={e => e.target.files[0] && handleUpload(tab, item.id, e.target.files[0])}
            />
          </label>
        </div>
      ))}

      {(!listFor || listFor.length === 0) && <p style={{ color: "#999" }}>Loading...</p>}
    </div>
  );
}