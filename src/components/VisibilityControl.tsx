"use client";

import { useEffect, useState } from "react";

export type Visibility = "PUBLIC" | "PASSWORD" | "RESTRICTED";

type TeamUser = { id: string; name: string; email: string };

type Props = {
  visibility: Visibility;
  onVisibilityChange: (v: Visibility) => void;
  password: string;
  onPasswordChange: (p: string) => void;
  hasExistingPassword?: boolean;
  viewerIds: string[];
  onViewerIdsChange: (ids: string[]) => void;
};

export function VisibilityControl({
  visibility,
  onVisibilityChange,
  password,
  onPasswordChange,
  hasExistingPassword,
  viewerIds,
  onViewerIdsChange,
}: Props) {
  const [users, setUsers] = useState<TeamUser[] | null>(null);

  useEffect(() => {
    if (visibility !== "RESTRICTED" || users !== null) return;
    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => setUsers(data.users || []))
      .catch(() => setUsers([]));
  }, [visibility, users]);

  function toggleViewer(userId: string) {
    if (viewerIds.includes(userId)) {
      onViewerIdsChange(viewerIds.filter((id) => id !== userId));
    } else {
      onViewerIdsChange([...viewerIds, userId]);
    }
  }

  return (
    <div className="field" style={{ marginTop: 14 }}>
      <label className="mono-label" htmlFor="visibility">
        Quién puede ver este reporte
      </label>
      <select
        id="visibility"
        value={visibility}
        onChange={(e) => onVisibilityChange(e.target.value as Visibility)}
        className="input"
        style={{ marginTop: 8 }}
      >
        <option value="PUBLIC">Cualquiera con el link</option>
        <option value="PASSWORD">Con contraseña</option>
        <option value="RESTRICTED">Solo usuarios seleccionados</option>
      </select>

      {visibility === "PASSWORD" && (
        <div style={{ marginTop: 10 }}>
          <input
            type="text"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder={hasExistingPassword ? "Nueva contraseña (opcional)" : "Contraseña de acceso"}
            className="input"
            maxLength={200}
          />
          {hasExistingPassword && (
            <div className="hint">Dejalo en blanco para mantener la contraseña actual.</div>
          )}
        </div>
      )}

      {visibility === "RESTRICTED" && (
        <div style={{ marginTop: 10 }}>
          {users === null && <div className="hint">Cargando usuarios...</div>}
          {users !== null && users.length === 0 && (
            <div className="hint">No hay otros usuarios registrados todavía.</div>
          )}
          {users !== null && users.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                maxHeight: 220,
                overflowY: "auto",
                border: "1px solid var(--line)",
                borderRadius: "var(--r-md)",
                padding: 12,
                background: "var(--surface-2)",
              }}
            >
              {users.map((u) => (
                <label key={u.id} className="replace">
                  <input
                    type="checkbox"
                    checked={viewerIds.includes(u.id)}
                    onChange={() => toggleViewer(u.id)}
                  />
                  {u.name} <span style={{ color: "var(--text-faint)" }}>({u.email})</span>
                </label>
              ))}
            </div>
          )}
          <div className="hint">Vos, como creador, siempre vas a poder verlo.</div>
        </div>
      )}
    </div>
  );
}
