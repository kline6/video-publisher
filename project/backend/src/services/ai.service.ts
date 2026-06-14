import { Pool } from "pg";
import OpenAI from "openai";
import { config } from "../config";
import { GenerateScriptDTO, GenerateTitleDTO, GenerateTagsDTO, AiGeneration, Platform } from "../types";
import { logger } from "../utils/logger";
import { settingsService } from "./settings.service";

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.username,
  password: config.db.password,
  database: config.db.database,
});

interface AiConfig { apiUrl: string; apiKey: string; model: string; }

async function getAiConfig(userId: number, modelOverride?: string): Promise<AiConfig> {
  try {
    const settings = await settingsService.getSettings(userId);
    if (settings?.ai_api_key && settings.ai_api_key !== "") {
      return {
        apiUrl: settings.ai_api_url,
        apiKey: settings.ai_api_key,
        model: modelOverride || settings.ai_model,
      };
    }
  } catch {}
  return {
    apiUrl: config.openai.baseUrl,
    apiKey: config.openai.apiKey,
    model: modelOverride || config.openai.model,
  };
}

function isOpenAIConfigured(cfg: AiConfig): boolean {
  return !!(cfg.apiKey && cfg.apiKey !== "" && !cfg.apiKey.startsWith("sk-your") && !cfg.apiKey.includes("..."));
}

function getClient(cfg: AiConfig): OpenAI | null {
  if (!isOpenAIConfigured(cfg)) return null;
  return new OpenAI({ apiKey: cfg.apiKey, baseURL: cfg.apiUrl });
}

export class AiService {
  private localGenerateScript(topic: string, style: string, duration?: number): string {
    const d = duration || 60;
    const title = topic + " - complete tutorial";
    const hook = "Did you know about " + topic + "? 99% of people miss this! Let me tell you in " + d + " seconds.";
    return JSON.stringify({
      title: title,
      hook: hook,
      sections: [
        { content: "[Opening shot: close-up]\nHey everyone! Today let's talk about " + topic + ".", duration: Math.round(d * 0.2) },
        { content: "[Scene switch: graphic display]\nFirst, we need to understand the core concept. The key to " + topic + " is methodology.", duration: Math.round(d * 0.4) },
        { content: "[Hands-on demo]\nNext let's see how to do it step by step. Follow along!", duration: Math.round(d * 0.3) },
      ],
      cta: "If you found this useful, remember to like and follow! Follow me for more content about " + topic + ".",
      estimated_duration: d + "s",
    }, null, 2);
  }

  private localGenerateTitles(topic: string, count: number): string[] {
    const templates = [
      topic + " - Watch this and you'll understand it all!",
      "3 secrets about " + topic + " that 99% of people don't know!",
      "Amazing! " + topic + " is done this way",
      topic + " complete guide - Must see for beginners",
      "Why is " + topic + " so popular? The truth is surprising",
      topic + " pitfall guide - Don't make these mistakes",
      topic + " in depth - Bookmark for later",
      topic + " hands-on sharing - Step by step tutorial",
      "2026 " + topic + " latest trends",
      topic + " deep analysis - Save 3 years of detours",
    ];
    return templates.slice(0, Math.min(count, templates.length));
  }

  private localGenerateTags(title: string): string[] {
    const base = title.replace(/[|,!.?]/g, " ").split(/\s+/).filter(Boolean).slice(0, 3);
    return [...base.map(t => "#" + t), "#useful", "#tutorial", "#beginners", "#tips", "#knowledge", "#trending2026", "#shortvideo", "#contentcreator"].slice(0, 12);
  }

  private localGenerateDescription(topic: string): string {
    return "This video takes you through everything about " + topic + "!\n\nKey points:\n1. Core concept analysis\n2. Step-by-step demo\n3. Common pitfalls\n4. Advanced tips\n\nIf you found it useful:\n- Like to support\n- Save for later\n- Follow for more content\n\n#" + topic + " #tutorial #useful #tips #knowledge";
  }

  private localGenerateCoverPrompt(topic: string, style?: string): string {
    return "A vibrant and eye-catching YouTube thumbnail for a video about " + topic + ", " + (style || "modern digital art") + " style, 16:9 aspect ratio, high resolution, bold text space at top, bright saturated colors, dynamic composition, professional quality, clean background with subtle gradient, trending on Dribbble and Behance";
  }

  async generateScript(userId: number, data: GenerateScriptDTO, modelOverride?: string): Promise<AiGeneration> {
    const cfg = await getAiConfig(userId, modelOverride);
    const client = getClient(cfg);

    if (!client) {
      logger.info("AI not configured, using local template for script");
      const result = this.localGenerateScript(data.topic, data.style, data.duration);
      return this.logGen(userId, "script", data.topic, result, "local-template");
    }

    const stylePrompts: Record<string, string> = {
      educational: "你是一位专业的中文教育类短视频脚本编剧。",
      story: "你是一位中文故事型短视频编剧。",
      "fast-paced": "你是一位中文快节奏短视频编剧。",
    };

    const response = await client.chat.completions.create({
      model: cfg.model,
      messages: [
        { role: "system", content: (stylePrompts[data.style] || stylePrompts.educational) + " 请用中文生成短视频脚本，包含：title（标题）、hook（开场钩子，含content和duration）、sections（分镜数组，每个含title/content/duration）、cta（结尾引导）。所有内容必须用中文。返回JSON格式。" },
        { role: "user", content: "Video topic: " + data.topic + ", duration: " + (data.duration || 60) + "s" + (data.platform ? ", platform: " + data.platform : "") },
      ],
      temperature: 0.8,
      max_tokens: 8000,
    });

    const content = (response.choices[0]?.message?.content || response.choices[0]?.message?.reasoning_content || "{}");
    await this.logGen(userId, "script", data.topic, content, cfg.model, response.usage?.total_tokens);

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
      return { raw_text: content };
    } catch { return { raw_text: content }; }
  }

  async generateTitles(userId: number, data: GenerateTitleDTO, modelOverride?: string): Promise<string[]> {
    const cfg = await getAiConfig(userId, modelOverride);
    const client = getClient(cfg);

    if (!client) {
      await this.logGen(userId, "title", data.topic, "local", "local-template");
      return this.localGenerateTitles(data.topic, data.count || 5);
    }

    const count = data.count || 5;
    const response = await client.chat.completions.create({
      model: cfg.model,
      messages: [
      { role: "system", content: "你是一位中文短视频标题优化专家。请用中文生成" + count + "个高点击率标题，运用数字、悬念、情感词和emoji。所有标题必须是中文。返回JSON数组格式。" },
        { role: "user", content: "Video topic: " + data.topic + (data.style ? ", style: " + data.style : "") },
      ],
      temperature: 0.9,
      max_tokens: 8000,
    });

    const content = (response.choices[0]?.message?.content || response.choices[0]?.message?.reasoning_content || "[]");
    await this.logGen(userId, "title", data.topic, content, cfg.model, response.usage?.total_tokens);

    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
      return content.split("\n").filter((l: string) => l.trim()).map((l: string) => l.replace(/^\d+\.\s*/, ""));
    } catch { return [content]; }
  }

  async generateTags(userId: number, data: GenerateTagsDTO, modelOverride?: string): Promise<string[]> {
    const cfg = await getAiConfig(userId, modelOverride);
    const client = getClient(cfg);

    if (!client) {
      await this.logGen(userId, "tags", data.title, "local", "local-template");
      return this.localGenerateTags(data.title);
    }

    const response = await client.chat.completions.create({
      model: cfg.model,
      messages: [
      { role: "system", content: "你是一位中文短视频SEO专家。请用中文生成10-15个相关标签，标签格式为#中文标签。返回JSON数组格式。" },
        { role: "user", content: "Video title: " + data.title + (data.description ? "\nDescription: " + data.description : "") },
      ],
      temperature: 0.7,
      max_tokens: 8000,
    });

    const content = (response.choices[0]?.message?.content || response.choices[0]?.message?.reasoning_content || "[]");
    await this.logGen(userId, "tags", data.title, content, cfg.model, response.usage?.total_tokens);

    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
      return content.split("\n").filter((l: string) => l.trim()).map((l: string) => l.replace(/^[#\d.\s-]+/, "").trim()).filter(Boolean);
    } catch { return [content]; }
  }

  async generateDescription(userId: number, topic: string, platform?: Platform, modelOverride?: string): Promise<string> {
    const cfg = await getAiConfig(userId, modelOverride);
    const client = getClient(cfg);

    if (!client) {
      await this.logGen(userId, "description", topic, "local", "local-template");
      return this.localGenerateDescription(topic);
    }

    const response = await client.chat.completions.create({
      model: cfg.model,
      messages: [
        { role: "system", content: "你是一位中文视频描述专家。请用中文生成一段150-300字的吸引人的视频描述，包含emoji表情和标签。所有内容必须用中文。" },
        { role: "user", content: "Video topic: " + topic + (platform ? ", target platform: " + platform : "") },
      ],
      temperature: 0.7,
      max_tokens: 8000,
    });

    const result = response.choices[0]?.message?.content || response.choices[0]?.message?.reasoning_content || "";
    await this.logGen(userId, "description", topic, result, cfg.model, response.usage?.total_tokens);
    return result;
  }

  async generateCoverPrompt(userId: number, topic: string, style?: string, modelOverride?: string): Promise<string> {
    const cfg = await getAiConfig(userId, modelOverride);
    const client = getClient(cfg);

    if (!client) {
      await this.logGen(userId, "cover_prompt", topic, "local", "local-template");
      return this.localGenerateCoverPrompt(topic, style);
    }

    const response = await client.chat.completions.create({
      model: cfg.model,
      messages: [
        { role: "system", content: "You are an AI art prompt expert. Generate Midjourney/DALL-E style cover image prompt in English." + (style ? " Style: " + style : "") },
        { role: "user", content: "Video topic: " + topic },
      ],
      temperature: 0.9,
      max_tokens: 8000,
    });

    const result = response.choices[0]?.message?.content || response.choices[0]?.message?.reasoning_content || "";
    await this.logGen(userId, "cover_prompt", topic, result, cfg.model, response.usage?.total_tokens);
    return result;
  }

  async getHistory(userId: number, type?: string): Promise<AiGeneration[]> {
    let query = "SELECT * FROM ai_generations WHERE user_id = $1";
    const params: any[] = [userId];
    if (type) { query += " AND type = $2"; params.push(type); }
    query += " ORDER BY created_at DESC LIMIT 50";
    const result = await pool.query(query, params);
    return result.rows;
  }

  

  async optimizeTopic(userId: number, keywords: string, platform?: string, modelOverride?: string): Promise<string[]> {
    const cfg = await getAiConfig(userId, modelOverride);
    const client = getClient(cfg);

    const platformHint = platform ? `, and the target platform is ${platform}` : '';
    const systemPrompt = "你是一位中文短视频选题专家。根据用户关键词，生成5个吸引人的中文视频主题建议。" +
      "主题要求简洁有力（15-25字），能激发好奇心，适合短视频平台。" +
  "所有主题必须是中文。返回JSON数组格式，不要返回其他内容。";
    const userPrompt = "Keywords: " + keywords + platformHint;

    if (!client) {
      const fallback = [
        keywords + ", 5 tips that changed my life",
        "99% of people don't know the truth about " + keywords,
        keywords + " for beginners! From zero to hero in 3 minutes",
        "Why is " + keywords + " suddenly trending? The answer is shocking",
        keywords + " pitfall guide, don't make these mistakes",
      ];
      await this.logGen(userId, "optimize_topic", keywords, JSON.stringify(fallback), "local-template");
      return fallback;
    }

    const response = await client.chat.completions.create({
      model: cfg.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.9,
      max_tokens: 8000,
    });

    const content = (response.choices[0]?.message?.content || response.choices[0]?.message?.reasoning_content || "[]");
    await this.logGen(userId, "optimize_topic", keywords, content, cfg.model, response.usage?.total_tokens);

    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
      return content.split("\n").filter((l: string) => l.trim()).map((l: string) => l.replace(/^\d+\.\s*/, "").replace(/^[-•]\s*/, ""));
    } catch {
      return [content];
    }
  }

private async logGen(userId: number, type: string, prompt: string, result: string, model: string, tokens?: number): Promise<AiGeneration> {
    const dbResult = await pool.query(
      "INSERT INTO ai_generations (user_id, type, prompt, result, model, tokens_used) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [userId, type, prompt, result, model, tokens || 0]
    );
    return dbResult.rows[0];
  }
}

export const aiService = new AiService();
