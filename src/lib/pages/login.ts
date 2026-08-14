import { api, saveSession, getAccessToken } from "@/lib/api";

if (getAccessToken()) window.location.replace("/app");

const form = document.querySelector<HTMLFormElement>("#login-form")!;
const error = document.querySelector<HTMLElement>("#login-error")!;
const expired = document.querySelector<HTMLElement>("#expired-message")!;
const password = document.querySelector<HTMLInputElement>("#password")!;
const toggle = document.querySelector<HTMLButtonElement>("#toggle-password")!;

if (new URLSearchParams(location.search).has("expired"))
  expired.dataset.visible = "true";
toggle.addEventListener("click", () => {
  password.type = password.type === "password" ? "text" : "password";
  toggle.textContent = password.type === "password" ? "Mostrar" : "Ocultar";
});
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  error.dataset.visible = "false";
  const submit = form.querySelector<HTMLButtonElement>('[type="submit"]')!;
  submit.disabled = true;
  submit.innerHTML = "Ingresando…";
  try {
    const data = await api<{ access: string; refresh: string }>(
      "/auth/login/",
      {
        auth: false,
        method: "POST",
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      },
    );
    saveSession(data.access, data.refresh);
    window.location.href = "/app";
  } catch (cause) {
    error.textContent =
      cause instanceof Error ? cause.message : "No pudimos iniciar sesión.";
    error.dataset.visible = "true";
    submit.disabled = false;
    submit.innerHTML = 'Ingresar a VetCare <i class="ti ti-arrow-right"></i>';
  }
});
