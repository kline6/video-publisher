import { generateBdTicketHeaders } from "./bd-ticket";
import { BasePlatformPublisher, PlatformPublishResult, VideoPublishData } from "./base.pub";
import { logger } from "../../utils/logger";
import * as crypto from "crypto";
import FormData from "form-data";
const crc32 = require("crc32");

const DEFAULT_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

interface DouyinAccountData {
  sessionid?: string;
  cookie: string;
  tokens?: { privateKey: string; webProtect: string };
}

interface UploadAuth {
  AccessKeyID: string;
  SecretAccessKey: string;
  SessionToken: string;
}

// ==================== AWS SigV4 for VOD API ====================

function credentialString(amzDate: string, region: string, service: string): string {
  return [amzDate.substring(0, 8), region, service, "aws4_request"].join("/");
}

function signedHeaders(headers: Record<string, string>): string {
  return Object.keys(headers)
    .map((k) => k.toLowerCase())
    .sort()
    .join(";");
}

function canonicalString(method: string, params: any, headers: Record<string, string>, body: any): string {
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map((k) => k.toLowerCase() + ":" + headers[k])
    .join("\n") + "\n";

  const bodyStr = body && Object.keys(body).length > 0 ? JSON.stringify(body) : "";
  const bodyHash = crypto.createHash("sha256").update(bodyStr).digest("hex");

  return [method.toUpperCase(), "/", httpBuildQuery(params), canonicalHeaders, signedHeaders(headers), bodyHash].join("\n");
}

function signature(
  secretAccessKey: string, amzDate: string, region: string, service: string,
  method: string, params: any, headers: Record<string, string>, body: any
): string {
  const amzDay = amzDate.substring(0, 8);
  const kDate = crypto.createHmac("sha256", "AWS4" + secretAccessKey).update(amzDay).digest();
  const kRegion = crypto.createHmac("sha256", kDate).update(region).digest();
  const kService = crypto.createHmac("sha256", kRegion).update(service).digest();
  const signingKey = crypto.createHmac("sha256", kService).update("aws4_request").digest();

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialString(amzDate, region, service),
    crypto.createHash("sha256").update(canonicalString(method, params, headers, body)).digest("hex"),
  ].join("\n");

  return crypto.createHmac("sha256", signingKey).update(stringToSign).digest("hex");
}

function httpBuildQuery(params: any): string {
  const sp = new URLSearchParams();
  for (const k in params) {
    if (params[k] !== null && params[k] !== undefined) sp.append(k, String(params[k]));
  }
  return sp.toString();
}

function generateAuthorizationHeaders(
  accessKeyID: string, secretAccessKey: string, sessionToken: string,
  region: string, service: string, method: string, params: any, body: any = {}
): Record<string, string> {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";

  const headers: Record<string, string> = {
    "X-Amz-Date": amzDate,
    "X-Amz-Security-Token": sessionToken,
  };
  if (body && Object.keys(body).length > 0) {
    headers["X-Amz-Content-Sha256"] = crypto.createHash("sha256").update(JSON.stringify(body)).digest("hex");
  }

  const sig = signature(secretAccessKey, amzDate, region, service, method, params, headers, body);
  headers["Authorization"] = [
    "AWS4-HMAC-SHA256 Credential=" + accessKeyID + "/" + credentialString(amzDate, region, service),
    "SignedHeaders=" + signedHeaders(headers),
    "Signature=" + sig,
  ].join(", ");

  return headers;
}

function generateRandomString(length: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

// ==================== File Part Info ====================

const FILE_BLOCK_SIZE = 3145728; // 3MB

interface FilePartInfo {
  fileSize: number;
  blockInfo: number[];
}

async function getFilePartInfo(filePath: string): Promise<FilePartInfo> {
  const fs = await import("fs");
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const blockCount = Math.ceil(fileSize / FILE_BLOCK_SIZE);
  const blockInfo: number[] = [];
  for (let i = 1; i < blockCount; i++) {
    blockInfo.push(i * FILE_BLOCK_SIZE);
  }
  blockInfo.push(fileSize);
  return { fileSize, blockInfo };
}

async function getFilePartContent(filePath: string, start: number, end: number): Promise<Buffer> {
  const fs = await import("fs");
  const fd = fs.openSync(filePath, "r");
  const buffer = Buffer.alloc(end - start);
  fs.readSync(fd, buffer, 0, end - start, start);
  fs.closeSync(fd);
  return buffer;
}

// ==================== Main Publisher ====================

export class DouyinApiPublisher extends BasePlatformPublisher {
  platform = "douyin";

  // --- Validate account ---
  async validateAccount(data: DouyinAccountData): Promise<{ valid: boolean; nickname?: string; uid?: string; error?: string }> {
    try {
      const resp = await fetch("https://www.douyin.com/aweme/v1/web/query/user/?device_platform=webapp&aid=6383", {
        headers: { "User-Agent": DEFAULT_UA, "Cookie": data.cookie, "Referer": "https://www.douyin.com/" },
        signal: AbortSignal.timeout(10000),
      });
      const json = await resp.json() as any;
      if (json.status_code === 0 && json.user) {
        return { valid: true, nickname: json.user.nickname, uid: json.user.uid || json.user.sec_uid };
      }
      return { valid: false, error: "Cookie 验证失败（" + (json.status_msg || "未知") + "），请确保已登录" };
    } catch (e: any) {
      return { valid: false, error: "连接失败: " + e.message };
    }
  }

  // --- Get upload auth from creator.douyin.com ---
  private async getUploadAuth(cookieString: string): Promise<UploadAuth> {
    const resp = await fetch("https://creator.douyin.com/web/api/media/upload/auth/v5/", {
      method: "GET",
      headers: { Cookie: cookieString, "User-Agent": DEFAULT_UA, Referer: "https://creator.douyin.com/" },
      signal: AbortSignal.timeout(15000),
    });
    const json = await resp.json() as any;
    if (!json || json.status_code !== 0) {
      throw new Error("获取上传凭证失败: " + (json?.status_msg || "未知错误") + "，账号可能已掉线!");
    }
    return JSON.parse(json.auth);
  }

  // --- Get CSRF token via HEAD request ---
  private async getSecsdkCsrfToken(cookieString: string): Promise<string> {
    const resp = await fetch("https://creator.douyin.com/web/api/media/anchor/search", {
      method: "HEAD",
      headers: {
        "User-Agent": DEFAULT_UA,
        Accept: "*/*",
        "Accept-Language": "zh-CN,zh;q=0.9",
        Connection: "keep-alive",
        Cookie: cookieString,
        Authority: "creator.douyin.com",
        Referer: "https://creator.douyin.com/creator-micro/home",
        "X-Secsdk-Csrf-Request": "1",
        "X-Secsdk-Csrf-Version": "1.2.22",
      },
      signal: AbortSignal.timeout(10000),
    });

    const csrfHeader = resp.headers.get("x-ware-csrf-token");
    if (!csrfHeader) {
      throw new Error("获取 CSRF Token 失败：响应头中没有 x-ware-csrf-token");
    }
    const parts = csrfHeader.split(",");
    return parts[1] || parts[0];
  }

  // --- Get bd-ticket headers from external service ---
  private getBdTicketHeaders(tokens: { privateKey: string; webProtect: string }): Record<string, string> {
    try {
      const headers = generateBdTicketHeaders(tokens.privateKey, tokens.webProtect, "/web/api/media/aweme/create/");
      logger.info("[Douyin] bd-ticket headers generated locally");
      return headers;
    } catch (e: any) {
      logger.warn("[Douyin] bd-ticket generation failed: " + e.message);
      return {};
    }
  }

  // --- Get user UID from creator API ---
  private async getUserUid(cookieString: string): Promise<string> {
    const resp = await fetch("https://creator.douyin.com/web/api/media/user/info/", {
      method: "GET",
      headers: { Cookie: cookieString, "User-Agent": DEFAULT_UA },
      signal: AbortSignal.timeout(15000),
    });
    const json = await resp.json() as any;
    if (!json || json.status_code !== 0 || !json.user) {
      throw new Error("获取用户 UID 失败: " + (json?.status_msg || "未知") + "，账号可能已掉线!");
    }
    return json.user.uid;
  }

  // --- Upload video to VOD and return videoId ---
  private async uploadVideo(filePath: string, cookieString: string, userUid: string): Promise<string> {
    logger.info("[Douyin] Starting video upload...");
    const { fileSize, blockInfo } = await getFilePartInfo(filePath);
    logger.info("[Douyin] File size: " + fileSize + " bytes, blocks: " + blockInfo.length);

    // Get upload auth
    const uploadAuth = await this.getUploadAuth(cookieString);
    logger.info("[Douyin] Upload auth obtained");

    // Build ApplyUploadInner params
    const applyParams: Record<string, any> = {
      Action: "ApplyUploadInner",
      FileSize: fileSize,
      FileType: "video",
      IsInner: 1,
      SpaceName: "aweme",
      Version: "2020-11-19",
      app_id: 2906,
      s: generateRandomString(11),
      user_id: userUid.toString(),
    };

    // Generate auth headers for VOD API
    const applyHeaders = generateAuthorizationHeaders(
      uploadAuth.AccessKeyID, uploadAuth.SecretAccessKey, uploadAuth.SessionToken,
      "cn-north-1", "vod", "GET", applyParams
    );

    // Request upload proof
    const proofResp = await fetch("https://vod.bytedanceapi.com/?" + httpBuildQuery(applyParams), {
      method: "GET",
      headers: applyHeaders,
      signal: AbortSignal.timeout(15000),
    });
    const proofJson = await proofResp.json() as any;

    if (proofJson?.ResponseMetadata?.Error) {
      throw new Error("获取上传凭证签名失败: " + proofJson.ResponseMetadata.Error.Message);
    }

    // Extract upload node info
    const uploadNode = proofJson.Result.InnerUploadAddress.UploadNodes[0];
    const storeUri = uploadNode.StoreInfos[0].StoreUri;
    const uploadHost = uploadNode.UploadHost;
    const uploadUrl = "https://" + uploadHost + "/upload/v1/" + storeUri;
    const uploadAuth2 = uploadNode.StoreInfos[0].Auth;
    const sessionKey = uploadNode.SessionKey;
    const logicalPartMode = uploadNode.UploadHeader["X-Logical-Part-Mode"];

    const uploadUuId = crypto.randomUUID();
    const baseParams: Record<string, any> = { uploadid: uploadUuId, uploadmode: null, phase: "transfer" };

    // Upload each block
    const crc32Parts: string[] = [];
    for (let i = 0; i < blockInfo.length; i++) {
      logger.info("[Douyin] Uploading block " + (i + 1) + "/" + blockInfo.length);
      const chunkStart = i === 0 ? 0 : blockInfo[i - 1];
      const chunkEnd = blockInfo[i];
      const chunk = await getFilePartContent(filePath, chunkStart, chunkEnd);
      const fileCrc32 = crc32(chunk).toString(16);

      const blockParams = { ...baseParams, part_number: i + 1, part_offset: i * FILE_BLOCK_SIZE };
      const blockResp = await fetch(uploadUrl + "?" + httpBuildQuery(blockParams), {
        method: "POST",
        headers: {
          Authorization: uploadAuth2,
          "Content-Crc32": fileCrc32,
          "Content-Type": "application/octet-stream",
          "X-Logical-Part-Mode": logicalPartMode,
          "X-Storage-U": userUid,
        },
        body: chunk,
        signal: AbortSignal.timeout(120000),
      });
      const blockJson = await blockResp.json() as any;

      if (!blockJson || blockJson.code !== 2000) {
        throw new Error("分片上传失败: " + (blockJson?.message || "unknown"));
      }
      crc32Parts.push(blockJson.data.part_number + ":" + blockJson.data.crc32);
    }

    // Merge blocks
    logger.info("[Douyin] Merging blocks...");
    const mergeParams = { ...baseParams, uploadmode: "part", phase: "finish" };
    const mergeResp = await fetch(uploadUrl + "?" + httpBuildQuery(mergeParams), {
      method: "POST",
      headers: {
        Authorization: uploadAuth2,
        "Content-Type": "text/plain;charset=UTF-8",
        "X-Logical-Part-Mode": logicalPartMode,
        "X-Storage-U": userUid,
      },
      body: Buffer.from(crc32Parts.join(",")),
      signal: AbortSignal.timeout(60000),
    });
    const mergeJson = await mergeResp.json() as any;
    if (!mergeJson || mergeJson.code !== 2000) {
      throw new Error("合并分片失败: " + (mergeJson?.message || "unknown"));
    }

    // Commit upload
    logger.info("[Douyin] Committing upload...");
    const commitParams: Record<string, any> = {
      Action: "CommitUploadInner",
      SpaceName: "aweme",
      Version: "2020-11-19",
      app_id: 2906,
      user_id: userUid,
    };
    const commitBody = { SessionKey: sessionKey, Functions: [] };
    const commitHeaders = generateAuthorizationHeaders(
      uploadAuth.AccessKeyID, uploadAuth.SecretAccessKey, uploadAuth.SessionToken,
      "cn-north-1", "vod", "POST", commitParams, commitBody
    );

    const commitResp = await fetch("https://vod.bytedanceapi.com/?" + httpBuildQuery(commitParams), {
      method: "POST",
      headers: { ...commitHeaders, "Content-Type": "application/json" },
      body: JSON.stringify(commitBody),
      signal: AbortSignal.timeout(60000),
    });
    const commitJson = await commitResp.json() as any;

    if (commitJson?.ResponseMetadata?.Error) {
      throw new Error("提交上传失败: " + commitJson.ResponseMetadata.Error.Message);
    }

    const videoId = commitJson.Result.Results[0].Vid;
    logger.info("[Douyin] Video uploaded, vid=" + videoId);
    return videoId;
  }

  // --- Build publish params ---
  private getPublishParams(title: string, description: string, tags?: string[]): Record<string, any> {
    let text = (title || "") + " " + (description || "");
    const textExtra: any[] = [];

    if (tags && tags.length > 0) {
      for (const tag of tags) {
        const extraItem = {
          start: text.length,
          type: 1,
          hashtag_name: tag,
          hashtag_id: 0,
          user_id: "",
          caption_start: 0,
          caption_end: 0,
        };
        text += "#" + tag + " ";
        (extraItem as any).end = text.length - 1;
        textExtra.push(extraItem);
      }
    }

    return {
      item_title: title || "",
      text: text.trim(),
      text_extra: textExtra,
      mentions: [],
      visibility_type: 0,
      download: 1,
      activity: "[]",
    };
  }

  // --- Publish via API ---
  async publish(data: DouyinAccountData, video: VideoPublishData): Promise<PlatformPublishResult> {
    try {
      logger.info("[Douyin] Publishing video via API: " + video.title);
      if (!video.videoPath) return { success: false, error: "未提供视频文件" };

      const cookieString = data.cookie;

      // 1. Get user UID
      const userUid = await this.getUserUid(cookieString);
      logger.info("[Douyin] User UID: " + userUid);

      // 2. Upload video to get video_id
      let videoId: string;
      if (video.videoPath.startsWith("http")) {
        // For remote URLs, we need to download first
        logger.info("[Douyin] Downloading remote video...");
        const tmpPath = require("os").tmpdir() + "/douyin_upload_" + Date.now() + ".mp4";
        const resp = await fetch(video.videoPath);
        if (!resp.ok) throw new Error("下载视频失败: " + resp.status);
        const fs = await import("fs");
        const buffer = Buffer.from(await resp.arrayBuffer());
        fs.writeFileSync(tmpPath, buffer);
        videoId = await this.uploadVideo(tmpPath, cookieString, userUid);
        try { fs.unlinkSync(tmpPath); } catch {}
      } else {
        videoId = await this.uploadVideo(resolvedPath, cookieString, userUid);
      }

      // 3. Get CSRF token
      const csrfToken = await this.getSecsdkCsrfToken(cookieString);
      logger.info("[Douyin] CSRF token obtained");

      // 4. Build publish params
      const publishParams = this.getPublishParams(video.title, video.description || "", video.tags);
      publishParams.video_id = videoId;
      publishParams.poster = ""; // Will use default cover

      // 5. Get bd-ticket headers if tokens available
      let bdTicketHeaders: Record<string, string> = {};
      if (data.tokens && data.tokens.privateKey && data.tokens.webProtect) {
        bdTicketHeaders = this.getBdTicketHeaders(data.tokens);
        logger.info("[Douyin] bd-ticket headers obtained");
      } else {
        logger.warn("[Douyin] No tokens available, publishing without bd-ticket (may fail)");
      }

      // 6. Publish via FormData POST
      const form = new FormData();
      for (const key of Object.keys(publishParams)) {
        const val = publishParams[key];
        if (val !== null && val !== undefined) {
          form.append(key, typeof val === "object" ? JSON.stringify(val) : String(val));
        }
      }

      const headers: Record<string, string> = {
        Cookie: cookieString,
        "X-Secsdk-Csrf-Token": csrfToken,
        ...bdTicketHeaders,
      };

      logger.info("[Douyin] Sending publish request...");
      const publishResp = await fetch("https://creator.douyin.com/web/api/media/aweme/create/", {
        method: "POST",
        headers: { ...headers, ...form.getHeaders() },
        body: form as any,
        signal: AbortSignal.timeout(30000),
      });

      const publishJson = await publishResp.json() as any;
      logger.info("[Douyin] Publish response: " + JSON.stringify(publishJson));

      if (publishJson?.status_code === 0) {
        const itemId = publishJson.item_id || publishJson.aweme?.aweme_id || "";
        const shareLink = "https://www.douyin.com/user/self?from_tab_name=main&modal_id=" + itemId;
        logger.info("[Douyin] Publish success! item_id=" + itemId);
        return { success: true, permalink: shareLink, platform_video_id: itemId };
      }

      // 403 or null data means re-auth needed
      if (publishJson?.status_code === 403 || !publishJson) {
        return { success: false, error: "请重新授权账号后发布（403）" };
      }

      return { success: false, error: "发布失败: " + (publishJson?.status_msg || JSON.stringify(publishJson)) };

    } catch (e: any) {
      logger.error("[Douyin] Publish error:", e);
      return { success: false, error: "发布异常: " + e.message };
    }
  }

  // --- Fetch video stats ---
  async fetchStats(data: DouyinAccountData, platformVideoId: string): Promise<{ views: number; likes: number; comments: number; shares: number }> {
    try {
      const resp = await fetch("https://www.douyin.com/aweme/v1/web/aweme/detail/?aweme_id=" + platformVideoId + "&device_platform=webapp&aid=6383", {
        headers: { "User-Agent": DEFAULT_UA, "Cookie": data.cookie, "Referer": "https://www.douyin.com/" },
        signal: AbortSignal.timeout(10000),
      });
      const json = await resp.json() as any;
      const stat = json.aweme_detail?.statistics;
      if (stat) return { views: stat.play_count || 0, likes: stat.digg_count || 0, comments: stat.comment_count || 0, shares: stat.share_count || 0 };
      return { views: 0, likes: 0, comments: 0, shares: 0 };
    } catch { return { views: 0, likes: 0, comments: 0, shares: 0 }; }
  }
}

export const douyinApiPublisher = new DouyinApiPublisher();
