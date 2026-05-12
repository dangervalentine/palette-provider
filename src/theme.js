export function getInitialTheme() {
  const stored = localStorage.getItem("palette-provider-theme");
  if (stored === "light" || stored === "dark") return stored;
  if (window.matchMedia("(prefers-color-scheme: light)").matches) return "light";
  return "dark";
}

export function setTheme(mode) {
  document.documentElement.setAttribute("data-theme", mode);
  localStorage.setItem("palette-provider-theme", mode);
}
