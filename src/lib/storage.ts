import "server-only";

import { createHash } from "node:crypto";

import {
  DeleteObjectsCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import {
  DOWNLOAD_URL_EXPIRES_SECONDS,
  UPLOAD_URL_EXPIRES_SECONDS,
} from "@/lib/constants";
import { AppError } from "@/lib/errors";

let internalStorageClient: S3Client | undefined;
let signingStorageClient: S3Client | undefined;

function storageConfig() {
  return {
    bucket: process.env.STORAGE_BUCKET ?? "exam-files",
    internalEndpoint:
      process.env.STORAGE_INTERNAL_ENDPOINT ?? "http://localhost:9000",
    publicEndpoint:
      process.env.STORAGE_PUBLIC_ENDPOINT ?? "http://localhost:9000",
    region: process.env.STORAGE_REGION ?? "us-east-1",
    accessKeyId: process.env.STORAGE_ACCESS_KEY_ID ?? "minioadmin",
    secretAccessKey:
      process.env.STORAGE_SECRET_ACCESS_KEY ?? "minioadmin",
    forcePathStyle: (process.env.STORAGE_FORCE_PATH_STYLE ?? "true") === "true",
  };
}

function createClient(endpoint: string) {
  const config = storageConfig();
  return new S3Client({
    region: config.region,
    endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

function getInternalStorageClient() {
  if (!internalStorageClient) {
    const config = storageConfig();
    internalStorageClient = createClient(config.internalEndpoint);
  }
  return internalStorageClient;
}

function getSigningStorageClient() {
  if (!signingStorageClient) {
    const config = storageConfig();
    signingStorageClient = createClient(config.publicEndpoint);
  }
  return signingStorageClient;
}

export async function createExamUploadUrl(input: {
  storageKey: string;
  sizeBytes: number;
  sha256: string;
}) {
  const config = storageConfig();
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: input.storageKey,
    ContentType: "application/pdf",
    ContentLength: input.sizeBytes,
    Metadata: { sha256: input.sha256.toLowerCase() },
  });
  const url = await getSignedUrl(getSigningStorageClient(), command, {
    expiresIn: UPLOAD_URL_EXPIRES_SECONDS,
  });
  return {
    url,
    expiresIn: UPLOAD_URL_EXPIRES_SECONDS,
    headers: {
      "content-type": "application/pdf",
      "x-amz-meta-sha256": input.sha256.toLowerCase(),
    },
  };
}

export async function inspectPdfObject(storageKey: string) {
  const config = storageConfig();
  const head = await getInternalStorageClient().send(
    new HeadObjectCommand({ Bucket: config.bucket, Key: storageKey }),
  );
  const object = await getInternalStorageClient().send(
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: storageKey,
    }),
  );
  if (!object.Body) {
    throw new AppError("ไม่สามารถอ่านไฟล์ที่อัปโหลดได้", 422, "EMPTY_OBJECT");
  }

  const hash = createHash("sha256");
  const signatureBytes: number[] = [];
  for await (const part of object.Body as AsyncIterable<Uint8Array>) {
    const bytes = part instanceof Uint8Array ? part : new Uint8Array(part);
    hash.update(bytes);
    for (const byte of bytes) {
      if (signatureBytes.length === 5) break;
      signatureBytes.push(byte);
    }
  }
  const signature = new TextDecoder().decode(Uint8Array.from(signatureBytes));

  if (!signature.startsWith("%PDF-")) {
    throw new AppError("ไฟล์ที่อัปโหลดไม่มี PDF signature ที่ถูกต้อง", 422, "INVALID_PDF");
  }

  return {
    contentLength: head.ContentLength ?? 0,
    contentType: head.ContentType ?? "",
    sha256: hash.digest("hex"),
    declaredSha256: head.Metadata?.sha256 ?? "",
  };
}

export async function createDownloadUrl(storageKey: string) {
  const config = storageConfig();
  return getSignedUrl(
    getSigningStorageClient(),
    new GetObjectCommand({ Bucket: config.bucket, Key: storageKey }),
    { expiresIn: DOWNLOAD_URL_EXPIRES_SECONDS },
  );
}

export async function putPrivateObject(input: {
  storageKey: string;
  body: Uint8Array;
  contentType: string;
  sha256: string;
}) {
  const config = storageConfig();
  await getInternalStorageClient().send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: input.storageKey,
      Body: input.body,
      ContentType: input.contentType,
      Metadata: { sha256: input.sha256 },
    }),
  );
}

export async function deletePrivateObject(storageKey: string) {
  const config = storageConfig();
  await getInternalStorageClient().send(
    new DeleteObjectCommand({ Bucket: config.bucket, Key: storageKey }),
  );
}

export async function purgeAllPrivateObjects() {
  const config = storageConfig();
  let continuationToken: string | undefined;
  let deleted = 0;

  do {
    const page = await getInternalStorageClient().send(
      new ListObjectsV2Command({
        Bucket: config.bucket,
        ContinuationToken: continuationToken,
      }),
    );
    const objects = (page.Contents ?? [])
      .filter((item): item is typeof item & { Key: string } => Boolean(item.Key))
      .map((item) => ({ Key: item.Key }));
    if (objects.length) {
      const result = await getInternalStorageClient().send(
        new DeleteObjectsCommand({
          Bucket: config.bucket,
          Delete: { Objects: objects, Quiet: true },
        }),
      );
      if (result.Errors?.length) {
        throw new Error(`ลบไฟล์ไม่สำเร็จ ${result.Errors.length} รายการ`);
      }
      deleted += objects.length;
    }
    continuationToken = page.IsTruncated
      ? page.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return deleted;
}
