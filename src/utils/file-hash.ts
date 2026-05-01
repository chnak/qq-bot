/**
 * 文件哈希计算工具
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";

/** 文件前 N 字节用于计算 md5_10m（协议定义：10002432 Bytes） */
const MD5_10M_SIZE = 10002432;

export interface FileHashes {
  md5: string;
  sha1: string;
  md5_10m: string;
}

/**
 * 流式计算文件的 MD5、SHA1、md5_10m（前 10002432 Bytes 的 MD5）
 */
export async function computeFileHashes(filePath: string, fileSize: number): Promise<FileHashes> {
  return new Promise((resolve, reject) => {
    const md5Hash = crypto.createHash("md5");
    const sha1Hash = crypto.createHash("sha1");
    const md5_10mHash = crypto.createHash("md5");

    let bytesRead = 0;
    const need10m = fileSize > MD5_10M_SIZE;

    const stream = fs.createReadStream(filePath);

    stream.on("data", (chunk: Buffer | string) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      md5Hash.update(buf);
      sha1Hash.update(buf);

      if (need10m) {
        const remaining = MD5_10M_SIZE - bytesRead;
        if (remaining > 0) {
          md5_10mHash.update(remaining >= buf.length ? buf : buf.subarray(0, remaining));
        }
      }

      bytesRead += buf.length;
    });

    stream.on("end", () => {
      const fullMd5 = md5Hash.digest("hex");
      const fullSha1 = sha1Hash.digest("hex");
      const md5_10m = need10m ? md5_10mHash.digest("hex") : fullMd5;

      resolve({
        md5: fullMd5,
        sha1: fullSha1,
        md5_10m,
      });
    });

    stream.on("error", reject);
  });
}

/**
 * 读取文件的指定区间（分片）
 */
export async function readFileChunk(filePath: string, offset: number, length: number): Promise<Buffer> {
  const fd = await fs.promises.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await fd.read(buffer, 0, length, offset);
    if (bytesRead < length) {
      return buffer.subarray(0, bytesRead);
    }
    return buffer;
  } finally {
    await fd.close();
  }
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * 获取文件大小
 */
export async function getFileSize(filePath: string): Promise<number> {
  const stat = await fs.promises.stat(filePath);
  return stat.size;
}

/**
 * 获取文件名
 */
export function getFileName(filePath: string): string {
  return filePath.split(/[/\\]/).pop() ?? "file";
}

/**
 * 上传文件大小限制（字节）
 */
export const FILE_SIZE_LIMITS: Record<number, number> = {
  1: 30 * 1024 * 1024,   // IMAGE:  30MB
  2: 100 * 1024 * 1024,  // VIDEO:  100MB
  3: 20 * 1024 * 1024,   // VOICE:  20MB
  4: 100 * 1024 * 1024,  // FILE:   100MB
};

export function getMaxUploadSize(fileType: number): number {
  return FILE_SIZE_LIMITS[fileType] ?? 100 * 1024 * 1024;
}

/**
 * 并发控制：带并发限制的异步任务执行器
 */
export async function runWithConcurrency(
  tasks: Array<() => Promise<void>>,
  maxConcurrent: number,
): Promise<void> {
  for (let i = 0; i < tasks.length; i += maxConcurrent) {
    const batch = tasks.slice(i, i + maxConcurrent);
    await Promise.all(batch.map((task) => task()));
  }
}

/**
 * PUT 分片数据到预签名 URL
 */
export async function putToPresignedUrl(
  presignedUrl: string,
  data: Buffer,
): Promise<void> {
  const response = await fetch(presignedUrl, {
    method: "PUT",
    body: data,
    headers: {
      "Content-Length": String(data.length),
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`COS PUT failed: ${response.status} ${response.statusText} - ${body}`);
  }
}
