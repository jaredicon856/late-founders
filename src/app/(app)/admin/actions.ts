"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isTestEmail } from "@/lib/admin";
import { hashPassword, requireAdmin, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { MAX_FILE, courseName, sizeText } from "@/lib/materials";
import { addNotice } from "@/lib/notices";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

export type ResetState = { password?: string; error?: string };
export type TeamState = { ok?: string; error?: string };

// A new random password, shown once to the admin to pass on privately.
// Logs the member out everywhere.
export async function resetPassword(_: ResetState, form: FormData): Promise<ResetState> {
  await requireAdmin();
  const userId = str(form.get("userId"));
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return { error: "No such member." };
  const password = randomBytes(9).toString("base64url");
  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(password) } });
  await db.session.deleteMany({ where: { userId } });
  return { password };
}

// Turning an account off logs them out and stops them logging back in. Their work is kept.
export async function setDisabled(form: FormData) {
  const me = await requireAdmin();
  const userId = str(form.get("userId"));
  const disabled = str(form.get("disabled")) === "1";
  if (userId === me.id) return;
  await db.user.update({ where: { id: userId }, data: { disabled } });
  if (disabled) await db.session.deleteMany({ where: { userId } });
  revalidatePath("/admin", "layout");
}

// Admins are only ever added here, by another admin, and only to an account
// that already exists: sign-up does not prove someone owns their email.
export async function setAdmin(_: TeamState, form: FormData): Promise<TeamState> {
  const me = await requireAdmin();
  const email = str(form.get("email")).toLowerCase();
  const make = str(form.get("make")) === "1";
  if (!email) return { error: "Enter an email." };
  if (!make && email === me.email) return { error: "You can't remove yourself." };
  const user = await db.user.findUnique({ where: { email }, select: { id: true, name: true } });
  if (!user) return { error: `No account uses ${email}. They need to sign up with the member code first, then you can make them an admin.` };
  await db.user.update({ where: { id: user.id }, data: { role: make ? "admin" : "member" } });
  revalidatePath("/admin", "layout");
  return { ok: make ? `${user.name} is now an admin.` : `${user.name} is no longer an admin.` };
}

// An admin changing their own password (the first admin's starts as a shared one).
export async function changeOwnPassword(_: TeamState, form: FormData): Promise<TeamState> {
  const me = await requireAdmin();
  const current = str(form.get("current"));
  const next = str(form.get("next"));
  const user = await db.user.findUnique({ where: { id: me.id }, select: { passwordHash: true } });
  if (!user || !(await verifyPassword(current, user.passwordHash))) return { error: "Your current password isn't right." };
  if (next.length < 10) return { error: "Use at least 10 characters." };
  if (next === current) return { error: "Choose a different password." };
  await db.user.update({ where: { id: me.id }, data: { passwordHash: await hashPassword(next) } });
  return { ok: "Password changed." };
}

// Deletes accounts on test email domains (e.g. qa+…@example.com) and all their work.
export async function removeTestAccounts(_: TeamState): Promise<TeamState> {
  const me = await requireAdmin();
  const all = await db.user.findMany({ select: { id: true, email: true } });
  const ids = all.filter((u) => isTestEmail(u.email) && u.id !== me.id).map((u) => u.id);
  if (!ids.length) return { ok: "There are no test accounts." };
  const { count } = await db.user.deleteMany({ where: { id: { in: ids } } });
  revalidatePath("/admin", "layout");
  return { ok: `Removed ${count} test ${count === 1 ? "account" : "accounts"}.` };
}

// ---------------------------------------------------------------------------
// Courses, materials and announcements
// ---------------------------------------------------------------------------

export type FormState = { ok?: string; error?: string };

const ALLOWED = /^(application\/pdf|image\/(png|jpeg|gif|webp)|text\/(plain|csv)|application\/(zip|vnd\.openxmlformats-officedocument\.[\w.]+|msword|vnd\.ms-excel|vnd\.ms-powerpoint))$/;

function revalidateMaterials() {
  revalidatePath("/admin", "layout");
  revalidatePath("/courses");
  revalidatePath("/resources");
  revalidatePath("/notifications");
}

export async function createCourse(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const title = str(form.get("title"));
  if (!title) return { error: "Give the course a title." };
  const c = await db.course.create({
    data: { title: title.slice(0, 120), pillar: str(form.get("pillar")).slice(0, 80), summary: str(form.get("summary")).slice(0, 500) },
    select: { id: true },
  });
  revalidateMaterials();
  return { ok: c.id };
}

export async function updateCourse(form: FormData) {
  await requireAdmin();
  const id = str(form.get("id"));
  const publish = form.get("publish");
  const data: { title?: string; pillar?: string; summary?: string; published?: boolean } = {};
  if (publish !== null) data.published = str(publish) === "1";
  else {
    const title = str(form.get("title"));
    if (title) data.title = title.slice(0, 120);
    data.pillar = str(form.get("pillar")).slice(0, 80);
    data.summary = str(form.get("summary")).slice(0, 500);
  }
  await db.course.update({ where: { id }, data });
  if (data.published) {
    const c = await db.course.findUnique({ where: { id }, select: { title: true } });
    if (c) await addNotice({ title: `New course: ${c.title}`, body: "It's on your Courses page now.", link: "/courses" });
  }
  revalidateMaterials();
}

export async function deleteCourse(form: FormData) {
  await requireAdmin();
  const id = str(form.get("id"));
  await db.$transaction([db.material.deleteMany({ where: { courseKey: id } }), db.course.deleteMany({ where: { id } })]);
  revalidateMaterials();
  // The course page no longer exists, so go back to the list.
  redirect("/admin/courses?deleted=1");
}

// A file (up to 4 MB), a link or a short note, added to a course or to the
// general Resources library (courseKey ""). Optionally announced on the bell.
export async function addMaterial(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const courseKey = str(form.get("courseKey"));
  const title = str(form.get("title")).slice(0, 160);
  const description = str(form.get("description")).slice(0, 1000);
  const kind = str(form.get("kind"));
  const file = form.get("file");
  if (!title) return { error: "Give it a title." };
  const where = courseKey ? (await courseName(courseKey)) : "Resources";
  if (!where) return { error: "That course no longer exists." };

  if (kind === "file") {
    if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload." };
    if (file.size > MAX_FILE) return { error: `That file is ${sizeText(file.size)}. The limit is 4 MB: compress the PDF, or upload it to Google Drive and add the link instead.` };
    const mimeType = file.type || "application/octet-stream";
    if (!ALLOWED.test(mimeType)) return { error: "Upload a PDF, image, Word, Excel, PowerPoint, text, CSV or zip file." };
    await db.material.create({
      data: { courseKey, title, description, kind, fileName: file.name, mimeType, data: Buffer.from(await file.arrayBuffer()), sizeBytes: file.size },
    });
  } else if (kind === "link") {
    const url = str(form.get("url"));
    if (!/^https:\/\/\S+$/.test(url)) return { error: "Paste a link that starts with https://." };
    await db.material.create({ data: { courseKey, title, description, kind, url } });
  } else if (kind === "note") {
    const body = str(form.get("body")).slice(0, 5000);
    if (!body) return { error: "Write the note." };
    await db.material.create({ data: { courseKey, title, description, kind, body } });
  } else return { error: "Choose file, link or note." };

  if (form.get("notify") === "on") {
    await addNotice({ title: `New in ${where}: ${title}`, body: description, link: courseKey ? "/courses" : "/resources" });
  }
  revalidateMaterials();
  return { ok: `Added “${title}”${form.get("notify") === "on" ? " and announced it" : ""}.` };
}

export async function toggleMaterial(form: FormData) {
  await requireAdmin();
  const id = str(form.get("id"));
  const m = await db.material.findUnique({ where: { id }, select: { published: true } });
  if (m) await db.material.update({ where: { id }, data: { published: !m.published } });
  revalidateMaterials();
}

export async function deleteMaterial(form: FormData) {
  await requireAdmin();
  await db.material.delete({ where: { id: str(form.get("id")) } }).catch(() => {});
  revalidateMaterials();
}

export async function postNotice(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const title = str(form.get("title"));
  const link = str(form.get("link"));
  if (!title) return { error: "Give the announcement a title." };
  if (link && !/^(https:\/\/\S+|\/\S*)$/.test(link)) return { error: "The link must start with https:// or be a page in the app like /courses." };
  await addNotice({ title, body: str(form.get("body")), link });
  revalidateMaterials();
  return { ok: "Posted. Members see it on their bell now." };
}

export async function deleteNotice(form: FormData) {
  await requireAdmin();
  await db.notice.delete({ where: { id: str(form.get("id")) } }).catch(() => {});
  revalidateMaterials();
}
