import Link from "next/link";
import { notFound } from "next/navigation";
import { courseLabel, getAsset } from "@/content/catalog";
import { PROFILE_FIELDS } from "@/content/profile";
import { getMode, getWorksheet } from "@/content/registry";
import Chat from "@/components/Chat";
import SopLibrary from "@/components/SopLibrary";
import SweepTool from "@/components/SweepTool";
import VersionList from "@/components/VersionList";
import WorksheetForm from "@/components/WorksheetForm";
import { getStatuses, isUnlocked, loadSheet } from "@/lib/assets";
import { aiConfigured, currentRun, getTranscript } from "@/lib/assistant/engine";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProfile } from "@/lib/record";
import { listSops } from "@/lib/sops";

export default async function AssetPage({ params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const asset = getAsset(assetId);
  if (!asset) notFound();
  const user = await requireUser();
  const [profile, statuses] = await Promise.all([getProfile(user.id), getStatuses(user.id)]);

  const head = (
    <>
      <div className="eyebrow">
        {courseLabel(asset.course)}
        {asset.lesson ? ` · ${asset.lesson}` : ""}
      </div>
      <h1 className="title">{asset.title}</h1>
      <div className="accent" />
    </>
  );

  if (!isUnlocked(assetId, profile, statuses)) {
    return (
      <>
        {head}
        <div className="card">
          <p>This course opens when you finish the one before it on your route.</p>
          <Link className="link" href="/courses">See your route</Link>
        </div>
      </>
    );
  }

  const versions = (
    await db.assetVersion.findMany({
      where: { userId: user.id, assetId },
      orderBy: { version: "desc" },
      select: { version: true, label: true, createdAt: true },
    })
  ).map((v) => ({ version: v.version, label: v.label, createdAt: v.createdAt.toISOString() }));

  if (asset.kind === "ai") {
    const mode = getMode(assetId);
    if (!mode) notFound();
    const loaded = mode.reads.filter((k) => profile[k] !== undefined && profile[k] !== null && profile[k] !== "");
    const run = await currentRun(user.id, assetId);
    const transcript = await getTranscript(user.id, assetId, run);
    const entry = mode.memberEntry ? ((profile[mode.memberEntry.key] as Record<string, unknown>) ?? {}) : null;
    return (
      <>
        {head}
        {loaded.length > 0 && (
          <div className="dashed" style={{ marginBottom: 18 }}>
            Loaded from your profile: {loaded.map((k) => (PROFILE_FIELDS[k] ?? k).toLowerCase()).join(", ")}. You will not be asked for any of it again.
          </div>
        )}
        <Chat
          assetId={assetId}
          initial={transcript}
          persistent={!!mode.persistent}
          disclaimer={mode.disclaimer ?? null}
          memberEntry={mode.memberEntry ? { ...mode.memberEntry, values: entry ?? {} } : null}
          connected={aiConfigured()}
          name={user.name}
          uploads={assetId === "sop-generator"}
        />
        <VersionList assetId={assetId} versions={versions} formats={["pdf", "docx"]} />
        <div className="note-bar" style={{ marginTop: 18 }}>
          Same assistant throughout the community. Opening a different tool switches its mode, its instructions and which part of your record it can read and write.
        </div>
      </>
    );
  }

  if (asset.kind === "tool") {
    return (
      <>
        {head}
        <SweepTool initialNames={Array.isArray(profile.name_candidates) ? (profile.name_candidates as string[]) : []} />
        <VersionList assetId={assetId} versions={versions} formats={["pdf", "xlsx"]} />
      </>
    );
  }

  if (asset.kind === "library") {
    const sops = await listSops(user.id);
    const roles = Array.isArray(profile.sop_roles) ? (profile.sop_roles as string[]) : [];
    return (
      <>
        {head}
        <SopLibrary initialSops={sops} initialRoles={roles} />
      </>
    );
  }

  const sheet = await loadSheet(user.id, assetId);
  const def = getWorksheet(assetId);
  if (!sheet || !def) notFound();
  return (
    <>
      {head}
      <p className="lede">{asset.summary}</p>
      <WorksheetForm
        assetId={assetId}
        initialData={sheet.data}
        profile={sheet.profile}
        status={sheet.status}
        readOnly={!!def.readOnly}
      />
      <VersionList assetId={assetId} versions={versions} formats={def.exports} current={!!def.readOnly} canExportCurrent />
    </>
  );
}
