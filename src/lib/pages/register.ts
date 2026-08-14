import { api, saveSession, getAccessToken } from "@/lib/api";

if (getAccessToken()) window.location.replace("/app");

const form = document.querySelector<HTMLFormElement>("#register-form")!;
const error = document.querySelector<HTMLElement>("#register-error")!;

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  error.dataset.visible = "false";
  const submit = form.querySelector<HTMLButtonElement>('[type="submit"]')!;
  submit.disabled = true;
  submit.innerHTML = "Creando tu espacio…";
  const payload = Object.fromEntries(new FormData(form));
  try {
    await api("/auth/register/", {
      auth: false,
      method: "POST",
      body: JSON.stringify(payload),
    });
    const tokens = await api<{ access: string; refresh: string }>(
      "/auth/login/",
      {
        auth: false,
        method: "POST",
        body: JSON.stringify({
          username: payload.username,
          password: payload.password,
        }),
      },
    );
    saveSession(tokens.access, tokens.refresh);
    window.location.href = "/app?welcome=1";
  } catch (cause) {
    error.textContent =
      cause instanceof Error ? cause.message : "No pudimos crear tu cuenta.";
    error.dataset.visible = "true";
    submit.disabled = false;
    submit.innerHTML = 'Crear mi cuenta <i class="ti ti-arrow-right"></i>';
    error.scrollIntoView({ behavior: "smooth", block: "center" });
  }
});
