import React from "react";
import Dashboard from "./Dashboard";
import { LanguageProvider } from "./i18n/LanguageContext";
import "./App.css";

function App() {
  return (
    <LanguageProvider>
      <div className="App">
        <Dashboard />
      </div>
    </LanguageProvider>
  );
}

export default App;

