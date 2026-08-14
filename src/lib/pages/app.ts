import { api, clearSession, currentUserId, getAccessToken } from "@/lib/api";

type User = {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  role: "CLIENT" | "VET" | "ADMIN";
  is_active: boolean;
};
type Pet = {
  id: number;
  name: string;
  species: string;
  breed: string;
  birth_date: string | null;
  weight: string;
  sex: string;
  is_active: boolean;
  owner: number;
};
type Service = {
  id: number;
  name: string;
  description: string;
  duration_minutes: number;
  price: string;
  is_active: boolean;
};
type Appointment = {
  id: number;
  pet: number;
  veterinarian: number;
  service: number;
  scheduled_at: string;
  status: string;
  reason: string;
  observations: string;
};
type RecordItem = {
  id: number;
  appointment: number;
  veterinarian: number;
  diagnosis: string;
  treatment: string;
  prescription: string;
  notes: string;
  created_at: string;
};

if (!getAccessToken()) window.location.replace("/login");

const state: {
  users: User[];
  pets: Pet[];
  services: Service[];
  appointments: Appointment[];
  records: RecordItem[];
  profile: User | null;
  view: string;
  status: string;
} = {
  users: [],
  pets: [],
  services: [],
  appointments: [],
  records: [],
  profile: null,
  view: "overview",
  status: "all",
};
const $ = <T extends Element>(selector: string) =>
  document.querySelector<T>(selector)!;
const $$ = <T extends Element>(selector: string) => [
  ...document.querySelectorAll<T>(selector),
];
const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>'"]/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[char]!,
  );
const names = {
  species: { DOG: "Perro", CAT: "Gato", BIRD: "Ave", OTHER: "Otro" },
  status: {
    PENDING: "Pendiente",
    CONFIRMED: "Confirmada",
    IN_PROGRESS: "En atención",
    COMPLETED: "Completada",
    CANCELED: "Cancelada",
  },
  role: { CLIENT: "Cliente", VET: "Veterinario", ADMIN: "Administrador" },
} as const;
const entityPath = {
  pet: "pets",
  appointment: "appointments",
  record: "medical-records",
  service: "services",
  user: "users",
} as const;
const dialog = $("#entity-dialog") as HTMLDialogElement;
const form = $("#entity-form") as HTMLFormElement;
let editing: { entity: keyof typeof entityPath; id?: number } | null = null;

$("#today-label").textContent = new Intl.DateTimeFormat("es-PE", {
  weekday: "long",
  day: "numeric",
  month: "long",
}).format(new Date());
if (new URLSearchParams(location.search).has("welcome"))
  $("#welcome-banner").hidden = false;
$("#welcome-banner button")?.addEventListener(
  "click",
  () => ($("#welcome-banner").hidden = true),
);
$("#logout-button").addEventListener("click", () => {
  clearSession();
  window.location.href = "/login";
});
$("#menu-button").addEventListener("click", () =>
  $("#sidebar").classList.toggle("open"),
);

function userName(id: number) {
  const item = state.users.find((user) => user.id === id);
  return item
    ? `${item.first_name || item.username} ${item.last_name}`.trim()
    : `Usuario #${id}`;
}
function petName(id: number) {
  return state.pets.find((pet) => pet.id === id)?.name || `Mascota #${id}`;
}
function serviceName(id: number) {
  return (
    state.services.find((service) => service.id === id)?.name ||
    `Servicio #${id}`
  );
}
function formatDate(value: string, withTime = true) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(value));
}
function formatDateTimeLocal(value: string) {
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function showToast(message: string) {
  const toast = $("#toast");
  toast.querySelector("span")!.textContent = message;
  toast.classList.add("visible");
  setTimeout(() => toast.classList.remove("visible"), 2800);
}
function empty(title: string, copy: string, icon = "ti-paw") {
  return `<div class="empty-state"><i class="ti ${icon}"></i><strong>${title}</strong><p>${copy}</p></div>`;
}
function actions(entity: string, id: number, canDelete = true) {
  return `<div class="row-actions"><button class="icon-button edit-action" data-edit="${entity}" data-id="${id}" aria-label="Editar"><i class="ti ti-pencil"></i></button>${canDelete ? `<button class="icon-button delete-action" data-delete="${entity}" data-id="${id}" aria-label="Eliminar"><i class="ti ti-trash"></i></button>` : ""}</div>`;
}

async function loadAll() {
  const error = $("#load-error");
  try {
    const results = await Promise.allSettled([
      api<User[]>("/users/"),
      api<Pet[]>("/pets/"),
      api<Service[]>("/services/"),
      api<Appointment[]>("/appointments/"),
      api<RecordItem[]>("/medical-records/"),
    ]);
    if (results[0].status === "fulfilled") state.users = results[0].value;
    if (results[1].status === "fulfilled") state.pets = results[1].value;
    if (results[2].status === "fulfilled") state.services = results[2].value;
    if (results[3].status === "fulfilled")
      state.appointments = results[3].value;
    if (results[4].status === "fulfilled") state.records = results[4].value;
    state.profile =
      state.users.find((user) => user.id === currentUserId()) || null;
    if (!state.profile && results[0].status === "rejected")
      throw results[0].reason;
    applyRole();
    renderAll();
  } catch (cause) {
    error.textContent =
      cause instanceof Error
        ? cause.message
        : "No pudimos cargar la información.";
    error.dataset.visible = "true";
  }
}

function applyRole() {
  const profile = state.profile;
  if (!profile) return;
  const fullName =
    `${profile.first_name || profile.username} ${profile.last_name}`.trim();
  $("#profile-name").textContent = fullName;
  $("#profile-role").textContent = names.role[profile.role];
  $("#profile-initials").textContent =
    `${profile.first_name?.[0] || profile.username[0]}${profile.last_name?.[0] || ""}`.toUpperCase();
  $("#greeting-name").textContent =
    `${profile.first_name || profile.username}.`;
  $$(".admin-only").forEach(
    (element) => ((element as HTMLElement).hidden = profile.role !== "ADMIN"),
  );
  $$(".vet-only").forEach(
    (element) =>
      ((element as HTMLElement).hidden =
        profile.role !== "VET" && profile.role !== "ADMIN"),
  );
  if (profile.role === "VET")
    $$('[data-create="appointment"]').forEach(
      (element) => ((element as HTMLElement).hidden = true),
    );
}

function renderAll() {
  $("#stat-pets").textContent = String(
    state.pets.filter((pet) => pet.is_active).length,
  );
  $("#stat-appointments").textContent = String(
    state.appointments.filter((item) =>
      ["PENDING", "CONFIRMED", "IN_PROGRESS"].includes(item.status),
    ).length,
  );
  $("#stat-records").textContent = String(state.records.length);
  renderOverview();
  renderPets();
  renderAppointments();
  renderRecords();
  renderServices();
  renderUsers();
  bindDynamicActions();
}

function renderOverview() {
  const upcoming = state.appointments
    .filter(
      (item) =>
        new Date(item.scheduled_at) >= new Date() && item.status !== "CANCELED",
    )
    .slice(0, 4);
  $("#upcoming-list").classList.remove("skeleton-list");
  $("#upcoming-list").innerHTML = upcoming.length
    ? upcoming
        .map(
          (item) =>
            `<div class="appointment-row"><div class="date-box"><strong>${new Date(item.scheduled_at).getDate()}</strong><span>${new Intl.DateTimeFormat("es-PE", { month: "short" }).format(new Date(item.scheduled_at))}</span></div><div class="appointment-copy"><strong>${escapeHtml(petName(item.pet))} · ${escapeHtml(serviceName(item.service))}</strong><span><i class="ti ti-clock"></i> ${formatDate(item.scheduled_at)} · ${escapeHtml(userName(item.veterinarian))}</span></div><span class="status status-${item.status.toLowerCase()}">${names.status[item.status as keyof typeof names.status] || item.status}</span></div>`,
        )
        .join("")
    : empty(
        "Tu agenda está libre",
        "Programa una cita cuando tu mascota la necesite.",
        "ti-calendar-heart",
      );
  const pets = state.pets.slice(0, 4);
  $("#overview-pets").innerHTML = pets.length
    ? pets
        .map(
          (pet) =>
            `<button data-edit="pet" data-id="${pet.id}"><span class="pet-symbol"><i class="ti ti-${pet.species === "CAT" ? "cat" : pet.species === "DOG" ? "dog" : "feather"}"></i></span><span><strong>${escapeHtml(pet.name)}</strong><small>${escapeHtml(names.species[pet.species as keyof typeof names.species] || pet.species)} · ${escapeHtml(pet.breed || "Sin raza")}</small></span><i class="ti ti-chevron-right"></i></button>`,
        )
        .join("")
    : empty("Aún no hay mascotas", "Registra su primer perfil para comenzar.");
}

function renderPets() {
  $("#pets-grid").innerHTML = state.pets.length
    ? state.pets
        .map(
          (pet) =>
            `<article class="entity-card pet-entity"><div class="entity-card-top"><span class="large-pet-symbol"><i class="ti ti-${pet.species === "CAT" ? "cat" : pet.species === "DOG" ? "dog" : "feather"}"></i></span>${actions("pet", pet.id)}</div><span class="eyebrow">${escapeHtml(names.species[pet.species as keyof typeof names.species] || pet.species)}</span><h3>${escapeHtml(pet.name)}</h3><p>${escapeHtml(pet.breed || "Sin raza registrada")}</p><div class="pet-details"><span><i class="ti ti-scale"></i> ${escapeHtml(pet.weight)} kg</span><span><i class="ti ti-gender-bigender"></i> ${pet.sex === "MALE" ? "Macho" : "Hembra"}</span></div></article>`,
        )
        .join("")
    : empty(
        "Tu familia empieza aquí",
        "Registra una mascota para organizar sus citas y cuidados.",
      );
}

function renderAppointments() {
  const filtered = state.appointments.filter(
    (item) => state.status === "all" || item.status === state.status,
  );
  $("#appointments-table").innerHTML = filtered.length
    ? filtered
        .map(
          (item) =>
            `<tr><td><strong>${formatDate(item.scheduled_at)}</strong></td><td>${escapeHtml(petName(item.pet))}</td><td>${escapeHtml(serviceName(item.service))}</td><td>${escapeHtml(userName(item.veterinarian))}</td><td><span class="status status-${item.status.toLowerCase()}">${names.status[item.status as keyof typeof names.status] || item.status}</span></td><td>${actions("appointment", item.id)}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="6">${empty("No hay citas en esta vista", "Prueba con otro filtro o programa una nueva cita.", "ti-calendar-off")}</td></tr>`;
}

function renderRecords() {
  $("#records-list").innerHTML = state.records.length
    ? state.records
        .map((record) => {
          const appt = state.appointments.find(
            (item) => item.id === record.appointment,
          );
          return `<article class="record-card"><div class="record-date"><span>${new Date(record.created_at).getFullYear()}</span><strong>${formatDate(record.created_at, false)}</strong></div><div class="record-main"><div class="record-heading"><div><span class="eyebrow">${appt ? escapeHtml(petName(appt.pet)) : `Cita #${record.appointment}`}</span><h3>${escapeHtml(record.diagnosis)}</h3></div>${state.profile?.role !== "CLIENT" ? actions("record", record.id) : ""}</div><div class="record-columns"><div><span>Tratamiento</span><p>${escapeHtml(record.treatment)}</p></div><div><span>Prescripción</span><p>${escapeHtml(record.prescription || "Sin prescripción")}</p></div><div><span>Notas</span><p>${escapeHtml(record.notes || "Sin notas adicionales")}</p></div></div><small>Atendió ${escapeHtml(userName(record.veterinarian))}</small></div></article>`;
        })
        .join("")
    : empty(
        "Sin historias clínicas todavía",
        "Aparecerán aquí después de una cita completada.",
        "ti-notes-off",
      );
}

function renderServices() {
  $("#services-grid").innerHTML = state.services.length
    ? state.services
        .filter((item) => item.is_active || state.profile?.role === "ADMIN")
        .map(
          (service) =>
            `<article class="entity-card service-entity"><div class="entity-card-top"><span class="service-icon"><i class="ti ti-stethoscope"></i></span>${state.profile?.role === "ADMIN" ? actions("service", service.id) : ""}</div><span class="eyebrow">${service.duration_minutes} minutos</span><h3>${escapeHtml(service.name)}</h3><p>${escapeHtml(service.description || "Atención veterinaria especializada.")}</p><div class="service-footer"><strong>S/ ${Number(service.price).toFixed(2)}</strong>${state.profile?.role === "CLIENT" ? `<button class="text-button" data-create="appointment" data-service="${service.id}">Elegir →</button>` : `<span class="status ${service.is_active ? "status-confirmed" : "status-canceled"}">${service.is_active ? "Activo" : "Inactivo"}</span>`}</div></article>`,
        )
        .join("")
    : empty(
        "No hay servicios disponibles",
        "Vuelve pronto para conocer nuevas opciones.",
        "ti-stethoscope-off",
      );
}

function renderUsers() {
  $("#users-table").innerHTML = state.users.length
    ? state.users
        .map(
          (user) =>
            `<tr><td><div class="user-cell"><span>${escapeHtml((user.first_name?.[0] || user.username[0]) + (user.last_name?.[0] || ""))}</span><div><strong>${escapeHtml(`${user.first_name} ${user.last_name}`.trim() || user.username)}</strong><small>@${escapeHtml(user.username)}</small></div></div></td><td><strong>${escapeHtml(user.email)}</strong><small>${escapeHtml(user.phone || "Sin teléfono")}</small></td><td>${names.role[user.role]}</td><td><span class="status ${user.is_active ? "status-confirmed" : "status-canceled"}">${user.is_active ? "Activo" : "Inactivo"}</span></td><td>${actions("user", user.id, user.id !== state.profile?.id)}</td></tr>`,
        )
        .join("")
    : "";
}

function bindDynamicActions() {
  $$<HTMLButtonElement>("[data-edit]").forEach(
    (button) =>
      (button.onclick = () =>
        openDialog(
          button.dataset.edit as keyof typeof entityPath,
          Number(button.dataset.id),
        )),
  );
  $$<HTMLButtonElement>("[data-delete]").forEach(
    (button) =>
      (button.onclick = () =>
        removeEntity(
          button.dataset.delete as keyof typeof entityPath,
          Number(button.dataset.id),
        )),
  );
  $$<HTMLButtonElement>("[data-create]").forEach(
    (button) =>
      (button.onclick = () =>
        openDialog(
          button.dataset.create as keyof typeof entityPath,
          undefined,
          button.dataset.service,
        )),
  );
}

function field(
  name: string,
  label: string,
  type = "text",
  value: unknown = "",
  attrs = "",
) {
  return `<div class="field"><label for="field-${name}">${label}</label><input id="field-${name}" name="${name}" type="${type}" value="${escapeHtml(value)}" ${attrs}></div>`;
}
function select(
  name: string,
  label: string,
  options: { value: string | number; label: string }[],
  value: unknown = "",
) {
  return `<div class="field"><label for="field-${name}">${label}</label><select id="field-${name}" name="${name}" required><option value="">Seleccionar</option>${options.map((option) => `<option value="${option.value}" ${String(option.value) === String(value) ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}</select></div>`;
}
function textarea(
  name: string,
  label: string,
  value: unknown = "",
  required = false,
) {
  return `<div class="field full"><label for="field-${name}">${label}</label><textarea id="field-${name}" name="${name}" ${required ? "required" : ""}>${escapeHtml(value)}</textarea></div>`;
}
function check(name: string, label: string, value: boolean) {
  return `<label class="check-field full"><input name="${name}" type="checkbox" ${value ? "checked" : ""}><span>${label}</span></label>`;
}

function openDialog(
  entity: keyof typeof entityPath,
  id?: number,
  presetService?: string,
) {
  editing = { entity, id };
  const item: any = id
    ? (entity === "pet"
        ? state.pets
        : entity === "appointment"
          ? state.appointments
          : entity === "record"
            ? state.records
            : entity === "service"
              ? state.services
              : state.users
      ).find((entry: any) => entry.id === id)
    : {};
  const titles = {
    pet: ["Mascota", "Registrar mascota"],
    appointment: ["Agenda", "Programar cita"],
    record: ["Historia clínica", "Crear historia"],
    service: ["Catálogo", "Nuevo servicio"],
    user: ["Administración", "Nuevo usuario"],
  };
  $("#dialog-eyebrow").textContent = titles[entity][0];
  $("#dialog-title").textContent = id
    ? `Editar ${titles[entity][0].toLowerCase()}`
    : titles[entity][1];
  let fields = "";
  if (entity === "pet")
    fields =
      field("name", "Nombre", "text", item.name, "required") +
      select(
        "species",
        "Especie",
        [
          { value: "DOG", label: "Perro" },
          { value: "CAT", label: "Gato" },
          { value: "BIRD", label: "Ave" },
          { value: "OTHER", label: "Otro" },
        ],
        item.species,
      ) +
      field("breed", "Raza", "text", item.breed) +
      field(
        "birth_date",
        "Fecha de nacimiento",
        "date",
        item.birth_date || "",
      ) +
      field(
        "weight",
        "Peso (kg)",
        "number",
        item.weight,
        'min="0.01" step="0.01" required',
      ) +
      select(
        "sex",
        "Sexo",
        [
          { value: "MALE", label: "Macho" },
          { value: "FEMALE", label: "Hembra" },
        ],
        item.sex,
      ) +
      check("is_active", "Perfil activo", item.is_active ?? true);
  if (entity === "appointment") {
    const appointmentPets = state.pets
      .filter((pet) => pet.is_active || pet.id === item.pet)
      .map((pet) => ({ value: pet.id, label: pet.name }));
    if (
      item.pet &&
      !appointmentPets.some((option) => option.value === item.pet)
    ) {
      appointmentPets.unshift({
        value: item.pet,
        label: petName(item.pet),
      });
    }
    fields =
      select(
        "pet",
        "Mascota",
        appointmentPets,
        item.pet,
      ) +
      select(
        "veterinarian",
        "Veterinario",
        state.users
          .filter((u) => u.role === "VET" && u.is_active)
          .map((u) => ({ value: u.id, label: userName(u.id) })),
        item.veterinarian,
      ) +
      select(
        "service",
        "Servicio",
        state.services
          .filter((s) => s.is_active)
          .map((s) => ({ value: s.id, label: s.name })),
        item.service || presetService,
      ) +
      field(
        "scheduled_at",
        "Fecha y hora",
        "datetime-local",
        item.scheduled_at ? formatDateTimeLocal(item.scheduled_at) : "",
        "required",
      ) +
      (id && state.profile?.role !== "CLIENT"
        ? select(
            "status",
            "Estado",
            Object.entries(names.status).map(([value, label]) => ({
              value,
              label,
            })),
            item.status,
          )
        : "") +
      textarea("reason", "Motivo", item.reason, true) +
      textarea("observations", "Observaciones", item.observations);
  }
  if (entity === "record")
    fields =
      select(
        "appointment",
        "Cita completada",
        state.appointments
          .filter(
            (a) =>
              a.status === "COMPLETED" &&
              !state.records.some((r) => r.appointment === a.id && r.id !== id),
          )
          .map((a) => ({
            value: a.id,
            label: `${petName(a.pet)} · ${formatDate(a.scheduled_at)}`,
          })),
        item.appointment,
      ) +
      textarea("diagnosis", "Diagnóstico", item.diagnosis, true) +
      textarea("treatment", "Tratamiento", item.treatment, true) +
      textarea("prescription", "Prescripción", item.prescription) +
      textarea("notes", "Notas", item.notes);
  if (entity === "service")
    fields =
      field("name", "Nombre", "text", item.name, "required") +
      field(
        "duration_minutes",
        "Duración (minutos)",
        "number",
        item.duration_minutes,
        'min="15" max="240" required',
      ) +
      field(
        "price",
        "Precio",
        "number",
        item.price,
        'min="0" step="0.01" required',
      ) +
      textarea("description", "Descripción", item.description) +
      check("is_active", "Servicio activo", item.is_active ?? true);
  if (entity === "user")
    fields =
      field("username", "Usuario", "text", item.username, "required") +
      field("first_name", "Nombre", "text", item.first_name) +
      field("last_name", "Apellido", "text", item.last_name) +
      field("email", "Correo", "email", item.email, "required") +
      field(
        "password",
        id ? "Nueva contraseña (opcional)" : "Contraseña",
        "password",
        "",
        'minlength="8" ' + (id ? "" : "required"),
      ) +
      field("phone", "Teléfono", "text", item.phone) +
      field("address", "Dirección", "text", item.address) +
      select(
        "role",
        "Rol",
        Object.entries(names.role).map(([value, label]) => ({
          value,
          label,
        })),
        item.role || "CLIENT",
      ) +
      check("is_active", "Usuario activo", item.is_active ?? true);
  $("#dialog-fields").innerHTML = fields;
  $("#dialog-error").dataset.visible = "false";
  dialog.showModal();
}

async function removeEntity(entity: keyof typeof entityPath, id: number) {
  if (
    !confirm(
      "¿Seguro que quieres eliminar este registro? Esta acción no se puede deshacer.",
    )
  )
    return;
  try {
    await api(`/${entityPath[entity]}/${id}/`, { method: "DELETE" });
    showToast("Registro eliminado");
    await loadAll();
  } catch (cause) {
    alert(
      cause instanceof Error ? cause.message : "No fue posible eliminarlo.",
    );
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!editing) return;
  const submit = $("#dialog-submit") as HTMLButtonElement;
  const error = $("#dialog-error");
  submit.disabled = true;
  submit.textContent = "Guardando…";
  error.dataset.visible = "false";
  const data: Record<string, any> = Object.fromEntries(new FormData(form));
  $$('#dialog-fields input[type="checkbox"]').forEach(
    (input: any) => (data[input.name] = input.checked),
  );
  ["pet", "veterinarian", "service", "appointment", "duration_minutes"].forEach(
    (key) => {
      if (data[key]) data[key] = Number(data[key]);
    },
  );
  if (data.scheduled_at)
    data.scheduled_at = new Date(data.scheduled_at).toISOString();
  if (!data.password) delete data.password;
  try {
    const path = `/${entityPath[editing.entity]}/${editing.id ? `${editing.id}/` : ""}`;
    await api(path, {
      method: editing.id ? "PATCH" : "POST",
      body: JSON.stringify(data),
    });
    dialog.close();
    showToast(editing.id ? "Cambios guardados" : "Registro creado");
    await loadAll();
  } catch (cause) {
    error.textContent =
      cause instanceof Error ? cause.message : "No fue posible guardar.";
    error.dataset.visible = "true";
  } finally {
    submit.disabled = false;
    submit.textContent = "Guardar";
  }
});

$("#dialog-close").addEventListener("click", () => dialog.close());
$("#dialog-cancel").addEventListener("click", () => dialog.close());
$$<HTMLButtonElement>(".nav-item[data-view]").forEach((button) =>
  button.addEventListener("click", () => switchView(button.dataset.view!)),
);
$$<HTMLButtonElement>("[data-view-link]").forEach((button) =>
  button.addEventListener("click", () => switchView(button.dataset.viewLink!)),
);
$$<HTMLButtonElement>(".filter").forEach((button) =>
  button.addEventListener("click", () => {
    state.status = button.dataset.status!;
    $$(".filter").forEach((b) => b.classList.toggle("active", b === button));
    renderAppointments();
    bindDynamicActions();
  }),
);
$("#global-search").addEventListener("input", (event) => {
  const query = (event.target as HTMLInputElement).value.toLowerCase();
  document
    .querySelectorAll(
      `#view-${state.view} article, #view-${state.view} tbody tr`,
    )
    .forEach(
      (item: any) =>
        (item.style.display = item.textContent.toLowerCase().includes(query)
          ? ""
          : "none"),
    );
});
function switchView(view: string) {
  state.view = view;
  $$(".view").forEach((v) =>
    v.classList.toggle("active", v.id === `view-${view}`),
  );
  $$(".nav-item[data-view]").forEach((item) =>
    item.classList.toggle(
      "active",
      (item as HTMLElement).dataset.view === view,
    ),
  );
  $("#sidebar").classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

loadAll();
