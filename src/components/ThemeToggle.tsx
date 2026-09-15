"use client";

type Theme = "dark" | "light";

function setTheme(t: Theme) {
  document.documentElement.setAttribute("data-theme", t);
  try {
    localStorage.setItem("report-hub-theme", t);
  } catch {
    // localStorage puede no estar disponible; el tema simplemente no persiste
  }
}

export function ThemeToggle() {
  return (
    <div className="theme-toggle" role="group" aria-label="Tema">
      <button type="button" data-theme-set="dark" onClick={() => setTheme("dark")}>
        Oscuro
      </button>
      <button type="button" data-theme-set="light" onClick={() => setTheme("light")}>
        Claro
      </button>
    </div>
  );
}
