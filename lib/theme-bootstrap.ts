export const themeStorageKey = "paradise-theme";

// A trusted, synchronous head script: no request data or user-provided code.
export const themeBootstrapScript = `(()=>{let dark=false;try{dark=window.localStorage.getItem(${JSON.stringify(themeStorageKey)})==="dark"}catch{}document.documentElement.classList.toggle("dark",dark)})();`;

export function readPersistedDarkTheme() {
  try {
    return window.localStorage.getItem(themeStorageKey) === "dark";
  } catch {
    return false;
  }
}
