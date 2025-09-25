// src/services/storage_s3.js
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({ region: process.env.AWS_REGION });
const BUCKET = process.env.S3_BUCKET;

export async function putObjectStream(key, contentType, bodyStream) {
  const cmd = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: bodyStream,
    ContentType: contentType || "application/octet-stream"
  });
  await s3.send(cmd);
  return { bucket: BUCKET, key };
}

export async function getObjectStream(key) {
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  const res = await s3.send(cmd);
  return {
    stream: res.Body, // readable stream
    contentType: res.ContentType || "application/octet-stream",
    contentLength: res.ContentLength
  };
}