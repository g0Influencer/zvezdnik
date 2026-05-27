import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initMetrika } from "./lib/metrika";

initMetrika();

createRoot(document.getElementById("root")!).render(<App />);
