/**
 * Tigris storage client — S3-compatible backend at fly.storage.tigris.dev.
 *
 * Used for:
 *   - Judge-verified artifact storage (replaces inline Convex blob)
 *   - Per-auction world-state snapshots (enable "replay run")
 *   - Context blob persistence (replaces Nia/Hyperspell context layer)
 *
 * Works in Convex "use node" actions and Next.js API routes.
 * All functions are non-throwing — callers get null on failure.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

function makeClient(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: process.env.TIGRIS_ENDPOINT_URL ?? "https://fly.storage.tigris.dev",
    credentials: {
      accessKeyId: process.env.TIGRIS_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.TIGRIS_SECRET_ACCESS_KEY ?? "",
    },
    forcePathStyle: false,
  });
}

function bucket(): string {
  return process.env.TIGRIS_BUCKET ?? "agora-artifacts";
}

function publicUrl(key: string): string {
  return `https://${bucket()}.fly.storage.tigris.dev/${key}`;
}

function isConfigured(): boolean {
  return !!(
    process.env.TIGRIS_ACCESS_KEY_ID &&
    process.env.TIGRIS_SECRET_ACCESS_KEY
  );
}

export interface TigrisResult {
  key: string;
  url: string;
}

/**
 * Upload any blob to Tigris. Returns { key, url } on success, null on failure.
 */
export async function putArtifact(
  key: string,
  body: string | Buffer,
  contentType = "application/json",
): Promise<TigrisResult | null> {
  if (!isConfigured()) return null;
  try {
    const client = makeClient();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket(),
        Key: key,
        Body: typeof body === "string" ? Buffer.from(body, "utf-8") : body,
        ContentType: contentType,
      }),
    );
    return { key, url: publicUrl(key) };
  } catch (err) {
    console.error("[tigris] putArtifact failed:", key, err);
    return null;
  }
}

/**
 * Download a blob from Tigris. Returns the raw buffer, or null on failure.
 */
export async function getArtifact(key: string): Promise<Buffer | null> {
  if (!isConfigured()) return null;
  try {
    const client = makeClient();
    const res = await client.send(
      new GetObjectCommand({ Bucket: bucket(), Key: key }),
    );
    if (!res.Body) return null;
    const chunks: Uint8Array[] = [];
    for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } catch (err) {
    console.error("[tigris] getArtifact failed:", key, err);
    return null;
  }
}

/**
 * Snapshot world-state for a given run — enables "replay run" in the UI.
 * Key: world-state/<taskId>/snapshot-<ts>.json
 */
export async function snapshotWorldState(
  taskId: string,
  data: object,
): Promise<TigrisResult | null> {
  const key = `world-state/${taskId}/snapshot-${Date.now()}.json`;
  return putArtifact(key, JSON.stringify(data, null, 2), "application/json");
}

/**
 * Persist a judge-verified artifact. Key: artifacts/<taskId>/<ts>.json
 */
export async function putJudgedArtifact(
  taskId: string,
  artifact: unknown,
): Promise<TigrisResult | null> {
  const key = `artifacts/${taskId}/${Date.now()}.json`;
  return putArtifact(key, JSON.stringify(artifact, null, 2), "application/json");
}

/**
 * Persist a context blob (replaces Nia/Hyperspell context layer).
 * Key: context/<taskId>.json
 */
export async function putContextBlob(
  taskId: string,
  context: object,
): Promise<TigrisResult | null> {
  const key = `context/${taskId}.json`;
  return putArtifact(key, JSON.stringify(context, null, 2), "application/json");
}

/**
 * Persist an Opsera scan result alongside the artifact.
 * Key: scans/<taskId>/<ts>.json
 */
export async function putScanResult(
  taskId: string,
  scanResult: object,
): Promise<TigrisResult | null> {
  const key = `scans/${taskId}/${Date.now()}.json`;
  return putArtifact(key, JSON.stringify(scanResult, null, 2), "application/json");
}
