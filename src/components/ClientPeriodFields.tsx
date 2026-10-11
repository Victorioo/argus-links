"use client";

import { useId } from "react";

type Props = {
  client: string;
  period: string;
  onClientChange: (v: string) => void;
  onPeriodChange: (v: string) => void;
  knownClients: string[];
};

export function ClientPeriodFields({
  client,
  period,
  onClientChange,
  onPeriodChange,
  knownClients,
}: Props) {
  const listId = useId();

  return (
    <div className="fields" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" }}>
      <div className="field">
        <label className="mono-label" htmlFor="client">
          Cliente (opcional)
        </label>
        <input
          id="client"
          type="text"
          value={client}
          onChange={(e) => onClientChange(e.target.value)}
          list={listId}
          maxLength={100}
          placeholder="Ej: Acme"
          autoComplete="off"
          className="input"
          style={{ marginTop: 8 }}
        />
        <datalist id={listId}>
          {knownClients.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
      <div className="field">
        <label className="mono-label" htmlFor="period">
          Período (opcional)
        </label>
        <input
          id="period"
          type="text"
          value={period}
          onChange={(e) => onPeriodChange(e.target.value)}
          maxLength={60}
          placeholder="Ej: Septiembre 2026"
          autoComplete="off"
          className="input"
          style={{ marginTop: 8 }}
        />
      </div>
    </div>
  );
}
