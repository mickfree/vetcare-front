# VetCare Front

Frontend web de VetCare construido con Astro 7 y Tailwind CSS 4. Incluye:

- Página pública de presentación.
- Registro e inicio de sesión con JWT.
- Panel adaptable para clientes, veterinarios y administradores.
- Gestión de mascotas, citas, historias clínicas, servicios y usuarios.

## Desarrollo local

El proxy de Astro espera que la API Django esté disponible en `http://127.0.0.1:8080`.

```powershell
pnpm install
pnpm astro dev --background
```

La aplicación estará disponible en `http://localhost:4321`.

```powershell
pnpm astro dev status
pnpm astro dev logs
pnpm astro dev stop
```

## Producción

Copia `.env.example` a `.env` y configura `PUBLIC_API_BASE_URL` con la dirección pública del backend. El backend debe permitir solicitudes CORS desde el dominio donde se publique este frontend.

```powershell
pnpm build
```
