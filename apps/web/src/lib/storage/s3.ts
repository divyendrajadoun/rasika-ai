import "server-only";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListPartsCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";

function makeClient(endpoint: string) {
  return new S3Client({
    endpoint,
    region: env.s3.region,
    forcePathStyle: env.s3.forcePathStyle,
    credentials: { accessKeyId: env.s3.accessKeyId, secretAccessKey: env.s3.secretAccessKey },
    // Third-party S3 (RustFS, MinIO, R2) rejects the SDK's default CRC32 flexible checksums on
    // presigned part uploads with BadDigest; only compute checksums when the API requires them.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

/** Server-side client (talks to S3 directly). */
export const s3 = makeClient(env.s3.endpoint);
/** Client used ONLY to presign URLs the browser will call (public endpoint). */
const s3Public = env.s3.publicEndpoint === env.s3.endpoint ? s3 : makeClient(env.s3.publicEndpoint);

const Bucket = () => env.s3.bucket;
const PRESIGN_TTL = 60 * 60; // 1 h

export const storageKey = {
  source: (userId: string, projectId: string, ext: string) =>
    `u/${userId}/p/${projectId}/source.${ext}`,
  reference: (userId: string, projectId: string, ext: string) =>
    `u/${userId}/p/${projectId}/reference.${ext}`,
  image: (userId: string, projectId: string, assetId: string, ext: string) =>
    `u/${userId}/p/${projectId}/img/${assetId}.${ext}`,
  thumbnail: (userId: string, projectId: string) => `u/${userId}/p/${projectId}/thumb.jpg`,
};

export async function createMultipart(key: string, contentType: string) {
  const out = await s3.send(
    new CreateMultipartUploadCommand({ Bucket: Bucket(), Key: key, ContentType: contentType }),
  );
  if (!out.UploadId) throw new Error("S3 did not return an UploadId");
  return out.UploadId;
}

export async function presignParts(key: string, uploadId: string, partNumbers: number[]) {
  return Promise.all(
    partNumbers.map(async (PartNumber) => ({
      partNumber: PartNumber,
      url: await getSignedUrl(
        s3Public,
        new UploadPartCommand({ Bucket: Bucket(), Key: key, UploadId: uploadId, PartNumber }),
        { expiresIn: PRESIGN_TTL },
      ),
    })),
  );
}

export async function listUploadedParts(key: string, uploadId: string) {
  const parts: Array<{ partNumber: number; etag: string; size: number }> = [];
  let marker: number | undefined;
  do {
    const out = await s3.send(
      new ListPartsCommand({
        Bucket: Bucket(),
        Key: key,
        UploadId: uploadId,
        PartNumberMarker: marker?.toString(),
      }),
    );
    for (const p of out.Parts ?? []) {
      if (p.PartNumber && p.ETag)
        parts.push({ partNumber: p.PartNumber, etag: p.ETag, size: p.Size ?? 0 });
    }
    marker =
      out.IsTruncated && out.NextPartNumberMarker ? Number(out.NextPartNumberMarker) : undefined;
  } while (marker !== undefined);
  return parts;
}

export async function completeMultipart(
  key: string,
  uploadId: string,
  parts: Array<{ partNumber: number; etag: string }>,
) {
  await s3.send(
    new CompleteMultipartUploadCommand({
      Bucket: Bucket(),
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: [...parts]
          .sort((a, b) => a.partNumber - b.partNumber)
          .map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })),
      },
    }),
  );
}

export async function abortMultipart(key: string, uploadId: string) {
  await s3
    .send(new AbortMultipartUploadCommand({ Bucket: Bucket(), Key: key, UploadId: uploadId }))
    .catch(() => {});
}

export async function presignPut(key: string, contentType: string, maxBytes?: number) {
  return getSignedUrl(
    s3Public,
    new PutObjectCommand({
      Bucket: Bucket(),
      Key: key,
      ContentType: contentType,
      ...(maxBytes ? { ContentLength: undefined } : {}),
    }),
    { expiresIn: PRESIGN_TTL },
  );
}

export async function presignGet(key: string, downloadName?: string) {
  return getSignedUrl(
    s3Public,
    new GetObjectCommand({
      Bucket: Bucket(),
      Key: key,
      ...(downloadName
        ? { ResponseContentDisposition: `attachment; filename="${downloadName}"` }
        : {}),
    }),
    { expiresIn: PRESIGN_TTL },
  );
}

export async function headObject(key: string) {
  try {
    const out = await s3.send(new HeadObjectCommand({ Bucket: Bucket(), Key: key }));
    return { size: out.ContentLength ?? 0, contentType: out.ContentType ?? "" };
  } catch {
    return null;
  }
}

export async function deleteObject(key: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: Bucket(), Key: key })).catch(() => {});
}
