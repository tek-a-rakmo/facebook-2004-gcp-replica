"use client";

import { useState } from "react";

export default function PhotoUpload({ defaultUrl }: { defaultUrl?: string }) {
  const [url, setUrl] = useState<string>(defaultUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload failed.");
        return;
      }
      setUrl(data.url);
    } catch {
      setError("Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <label htmlFor="photo">Photo</label>
      <input
        id="photo"
        type="file"
        accept="image/*"
        onChange={handleChange}
      />
      {uploading && <div className="tf-small tf-muted">uploading...</div>}
      {error && <div className="tf-error">{error}</div>}
      {url && (
        <div style={{ marginTop: 6 }}>
          <img className="tf-photo" src={url} width={180} alt="Profile photo" />
        </div>
      )}
      <input type="hidden" name="photoUrl" value={url} />
    </>
  );
}
