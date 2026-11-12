import { memberTz, withTz } from "@/lib/tz";
import { notFound } from "next/navigation";
import { courseLabel, getAsset } from "@/content/catalog";
import { PROFILE_FIELDS } from "@/content/profile";
import { getMode, getWorksheet } from "@/content/registry";
import Chat from "@/components/Chat";
import SopLibrary from "@/components/SopLibrary";
import SweepTool from "@/components/SweepTool";
import VersionList from "@/components/VersionList";
import NextUp from "@/components/NextUp";
import WorksheetForm from "@/components/WorksheetForm";
import WorksheetHelp from "@/components/WorksheetHelp";
import { getStatuses, loadSheet, setStatus } from "@/lib/assets";
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
  const tz = await memberTz();
  const [profile, statuses] = await Promise.all([getProfile(user.id), getStatuses(user.id)]);
  // A read-only guide is done once it has been opened.
  if (getWorksheet(assetId)?.readOnly && statuses[assetId]?.status !== "complete") {
    await setStatus(user.id, assetId, "complete");
    statuses[assetId] = { status: "complete", updatedAt: new Date() };
  }
  const nextUp = statuses[assetId]?.status === "complete" ? <NextUp profile={profile} statuses={statuses} /> : null;

  const calendar =
    (assetId === "decision-engine" && profile.quit_decision) || assetId === "campaign-metrics" ? (
      <div className="dl" style={{ marginTop: 12 }}>
        <a className="btn-ghost" href={`/api/calendar/${assetId}`}>Add the dates to your calendar (.ics)</a>
        <span className="muted small" style={{ alignSelf: "center" }}>
          {assetId === "decision-engine" ? "Your trigger months, plus a monthly Runway Calculator update." : "A weekly logging reminder, and the date your next change is allowed."}
        </span>
      </div>
    ) : null;
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
          name={user.fullName}
          uploads={assetId === "sop-generator"}
        />
        <VersionList tz={tz} assetId={assetId} versions={versions} formats={["pdf", "docx"]} />
        {calendar}
        {nextUp}
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
        <VersionList tz={tz} assetId={assetId} versions={versions} formats={["pdf", "xlsx"]} />
        {nextUp}
      </>
    );
  }

  if (asset.kind === "library" && !getWorksheet(assetId)) {
    const sops = await listSops(user.id);
    const roles = Array.isArray(profile.sop_roles) ? (profile.sop_roles as string[]) : [];
    return (
      <>
        {head}
        <SopLibrary initialSops={sops} initialRoles={roles} />
        {nextUp}
      </>
    );
  }

  const sheet = await withTz(() => loadSheet(user.id, assetId));
  const def = getWorksheet(assetId);
  if (!sheet || !def) notFound();
  return (
    <>
      {head}
      <p className="lede">{asset.summary}</p>
      {aiConfigured() && <WorksheetHelp assetId={assetId} title={asset.title} />}
      <WorksheetForm
        assetId={assetId}
        initialData={sheet.data}
        profile={sheet.profile}
        status={sheet.status}
        readOnly={!!def.readOnly}
      />
      <VersionList tz={tz} assetId={assetId} versions={versions} formats={def.exports} current={!!def.readOnly} canExportCurrent />
      {calendar}
      {nextUp}
    </>
  );
}
