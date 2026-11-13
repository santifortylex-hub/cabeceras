// Crea (o actualiza) el usuario administrador inicial.
// Uso: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NOMBRE en .env.local  →  npm run create-admin
import { createClient } from "@supabase/supabase-js";

const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key, ADMIN_EMAIL: email, ADMIN_PASSWORD: password } = process.env;
const nombre = process.env.ADMIN_NOMBRE || "Administrador";
if (!url || !key || !email || !password) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL o ADMIN_PASSWORD en .env.local");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await sb.auth.admin.createUser({
  email, password, email_confirm: true, user_metadata: { nombre }, app_metadata: { rol: "admin" },
});
if (error) {
  if (!/already|registered/i.test(error.message)) { console.error(error.message); process.exit(1); }
  const { data: list } = await sb.auth.admin.listUsers({ perPage: 1000 });
  const u = list.users.find((x) => x.email === email);
  await sb.auth.admin.updateUserById(u.id, { password, app_metadata: { rol: "admin" } });
  await sb.from("perfiles").update({ rol: "admin", activo: true }).eq("id", u.id);
  console.log(`Usuario existente actualizado como administrador: ${email}`);
} else {
  console.log(`Administrador creado: ${data.user.email}`);
}
