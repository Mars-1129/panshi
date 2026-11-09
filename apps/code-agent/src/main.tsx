import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import App from "./App"
import "../../../ui-kit-v4/css/styles.css"
import "./panshi.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
