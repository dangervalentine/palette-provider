import { useState } from "react";
import logo from "./swatch-finder.svg";
import { getInitialTheme, setTheme } from "./theme";
import { UploadIcon } from "./Toolbar";

const Header = ({ onUpload }) => {
  const [mode, setMode] = useState(getInitialTheme);

  const toggle = () => {
    const next = mode === "dark" ? "light" : "dark";
    setMode(next);
    setTheme(next);
  };

  return (
    <header>
      <img className="logo" src={logo} alt="palette provider logo" />
      <div className="header-text">
        <p className="title">Palette Provider</p>
        <a
          target="_blank"
          className="credit"
          rel="noopener noreferrer"
          href="https://github.com/dangervalentine/palette-provider"
        >
          <p>by Danger Valentine</p>
        </a>
      </div>
      {onUpload && (
        <button
          className="btn-ghost header-upload"
          onClick={onUpload}
          aria-label="Upload image"
        >
          <UploadIcon />
        </button>
      )}
      <div className="theme-toggle" onClick={toggle} role="button" tabIndex={0}>
        <span>{"\u263D"}</span>
        <div className="theme-toggle-track">
          <div className={`theme-toggle-thumb ${mode}`} />
        </div>
        <span>{"\u2600"}</span>
      </div>
    </header>
  );
};

export default Header;
