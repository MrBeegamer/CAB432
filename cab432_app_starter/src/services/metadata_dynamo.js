// src/services/metadata_dynamo.js
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand
} from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION }));

const FILES_TABLE = process.env.DDB_FILES_TABLE;
const JOBS_TABLE = process.env.DDB_JOBS_TABLE;

/** FILES **/
export async function putFileRec(file) {
  await ddb.send(new PutCommand({ TableName: FILES_TABLE, Item: file }));
  return file;
}

export async function getFileRec(fileId) {
  const out = await ddb.send(new GetCommand({ TableName: FILES_TABLE, Key: { fileId } }));
  return out.Item || null;
}

export async function listFilesByOwner(owner) {
  // Requires a GSI named "ownerCreatedAt" with (owner HASH, createdAt RANGE)
  const out = await ddb.send(new QueryCommand({
    TableName: FILES_TABLE,
    IndexName: "ownerCreatedAt",
    KeyConditionExpression: "#o = :o",
    ExpressionAttributeNames: { "#o": "owner" },
    ExpressionAttributeValues: { ":o": owner },
    ScanIndexForward: false
  }));
  return out.Items || [];
}

/** JOBS **/
export async function putJobRec(job) {
  await ddb.send(new PutCommand({ TableName: JOBS_TABLE, Item: job }));
  return job;
}

export async function getJobRec(jobId) {
  const out = await ddb.send(new GetCommand({ TableName: JOBS_TABLE, Key: { jobId } }));
  return out.Item || null;
}

export async function listJobsByOwner(owner) {
  const out = await ddb.send(new QueryCommand({
    TableName: JOBS_TABLE,
    IndexName: "ownerCreatedAt",
    KeyConditionExpression: "#o = :o",
    ExpressionAttributeNames: { "#o": "owner" },
    ExpressionAttributeValues: { ":o": owner },
    ScanIndexForward: false
  }));
  return out.Items || [];
}

export async function updateJobStatus(jobId, patch) {
  const keys = Object.keys(patch);
  if (!keys.length) return;
  const setExpr = keys.map((k, i) => `#${i} = :${i}`).join(", ");
  const names = Object.fromEntries(keys.map((k, i) => [`#${i}`, k]));
  const values = Object.fromEntries(keys.map((k, i) => [`:${i}`, patch[k]]));
  await ddb.send(new UpdateCommand({
    TableName: JOBS_TABLE,
    Key: { jobId },
    UpdateExpression: `SET ${setExpr}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values
  }));
}