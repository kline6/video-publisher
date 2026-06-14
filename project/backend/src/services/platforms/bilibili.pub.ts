import { BasePlatformPublisher, PlatformPublishResult, VideoPublishData } from './base.pub';
import { logger } from '../../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

const BILIBILI_API = 'https://api.bilibili.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36';

interface BilibiliAccountData {
  sessdata: string;
  bili_jct: string;
  dedeuserid: string;
}

function buildCookie(data: BilibiliAccountData): string {
  return `SESSDATA=${data.sessdata}; bili_jct=${data.bili_jct}; DedeUserID=${data.dedeuserid}`;
}

async function biliFetch(url: string, data: BilibiliAccountData, options: RequestInit = {}): Promise<any> {
  const resp = await fetch(url, {
    ...options,
    headers: {
      'User-Agent': UA,
      'Cookie': buildCookie(data),
      'Referer': 'https://www.bilibili.com',
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(30000),
  });
  const text = await resp.text();
  try { return JSON.parse(text); } catch {
    logger.error('[Bilibili] Non-JSON from ' + url + ': ' + text.substring(0, 200));
    return { code: -1, message: 'Non-JSON response' };
  }
}

function sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)); }
function randomDelay(min = 500, max = 1500): Promise<void> { return sleep(min + Math.random() * (max - min)); }

export class BilibiliPublisher extends BasePlatformPublisher {
  platform = 'bilibili';

  async validateAccount(data: BilibiliAccountData): Promise<{ valid: boolean; nickname?: string; uid?: string; error?: string }> {
    try {
      const resp = await biliFetch(`${BILIBILI_API}/x/web-interface/nav`, data);
      if (resp.code === 0 && resp.data?.isLogin) {
        return { valid: true, nickname: resp.data.uname, uid: String(resp.data.mid) };
      }
      return { valid: false, error: resp.message || 'Cookie 无效或已过期' };
    } catch (e: any) {
      return { valid: false, error: '连接失败: ' + e.message };
    }
  }

  async publish(data: BilibiliAccountData, video: VideoPublishData): Promise<PlatformPublishResult> {
    try {
      logger.info('[Bilibili] Starting Playwright publish: ' + video.title);

      if (!video.videoPath) {
        return { success: false, error: '未提供视频文件' };
      }

      // Resolve video path
      let filePath = video.videoPath;
      if (!filePath.startsWith('http')) {
        const hasDriveLetter = /^[a-zA-Z]:[\\/]/.test(filePath);
        if (!hasDriveLetter) {
          filePath = path.join(process.cwd(), filePath.replace(/^[\\/]+/, ''));
        }
      }
      if (!filePath.startsWith('http') && !fs.existsSync(filePath)) {
        return { success: false, error: '视频文件不存在: ' + filePath };
      }
      logger.info('[Bilibili] Video path: ' + filePath);

      const { chromium } = require('playwright');
      let browser = null;
      const debugDir = path.join(process.cwd(), 'storage_states');
      if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });

      try {
        browser = await chromium.launch({
          channel: 'chrome',
          headless: false,
          args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--window-size=1920,1080', '--lang=zh-CN'],
        });

        // Build cookies for Playwright context
        const cookies = [
          { name: 'SESSDATA', value: data.sessdata, domain: '.bilibili.com', path: '/' },
          { name: 'bili_jct', value: data.bili_jct, domain: '.bilibili.com', path: '/' },
          { name: 'DedeUserID', value: data.dedeuserid, domain: '.bilibili.com', path: '/' },
        ];

        const context = await browser.newContext({
          userAgent: UA,
          viewport: { width: 1920, height: 1080 },
          locale: 'zh-CN',
          timezoneId: 'Asia/Shanghai',
        });
        await context.addCookies(cookies);

        // Anti-detection
        await context.addInitScript(`
          Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        `);

        const page = await context.newPage();

        // Step 1: Go to upload page
        logger.info('[Bilibili] Step 1: Navigate to upload page...');
        await page.goto('https://member.bilibili.com/platform/upload/video/frame', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
        await randomDelay(2000, 4000);

        // Check if logged in
        const url = page.url();
        if (url.includes('passport') || url.includes('login')) {
          const ss = path.join(debugDir, 'debug_bili_login_' + Date.now() + '.png');
          await page.screenshot({ path: ss, fullPage: true });
          return { success: false, error: 'B站Cookie已失效，请重新绑定。截图: ' + ss };
        }

        logger.info('[Bilibili] Page loaded: ' + page.url());

                // Step 2: Upload video file
        logger.info('[Bilibili] Step 2: Uploading video...');
        
        // Bilibili upload: input[type=file] is display:none inside div.upload-area
        // Playwright setInputFiles needs to force it visible first
        logger.info('[Bilibili] Setting up file input...');
        await page.evaluate(() => {
          const inp = document.querySelector('.bcc-upload-wrapper input[type="file"], .upload-area input[type="file"], input[type="file"][accept*=".mp4"]');
          if (inp) {
            inp.style.cssText = "display:block !important; position:fixed; top:0; left:0; width:200px; height:50px; z-index:999999; opacity:1; visibility:visible;";
          }
        });
        await randomDelay(500, 1000);

        // Now find and set files on the input
        let fileInput = null;
        for (const sel of [
          '.bcc-upload-wrapper input[type="file"]',
          '.upload-area input[type="file"]',
          'input[type="file"][accept*=".mp4"]',
          'input[type="file"]',
        ]) {
          try {
            fileInput = await page.$(sel);
            if (fileInput) {
              logger.info('[Bilibili] Found input: ' + sel);
              break;
            }
          } catch {}
        }

        if (!fileInput) {
          const ss = path.join(debugDir, 'debug_bili_no_input_' + Date.now() + '.png');
          await page.screenshot({ path: ss, fullPage: true });
          return { success: false, error: '找不到上传入口。截图: ' + ss };
        }

        await fileInput.setInputFiles(filePath);
        logger.info('[Bilibili] File set on input');

        // Step 3: Wait for upload to complete (Bilibili uploads via AJAX)
        logger.info('[Bilibili] Step 3: Waiting for upload to complete...');
        await randomDelay(3000, 5000); // Give B站 frontend time to start upload

        // Take screenshot to debug
        try { await page.screenshot({ path: path.join(debugDir, 'debug_bili_after_select_' + Date.now() + '.png'), fullPage: true }); } catch {}

        let uploadOk = false;
        for (let i = 0; i < 90; i++) { // 90 * 3s = up to 4.5 minutes
          await sleep(3000);
          try {
            const content = await page.evaluate(() => document.body?.innerText || '');
            const url2 = page.url();

            // Check various completion indicators
            if (['上传完成', '投稿成功', '稿件投递', '基本设置', '稿件管理', '提交投稿', '立即投稿'].some(s => content.includes(s))) {
              uploadOk = true;
              logger.info('[Bilibili] Upload complete (text match)');
              break;
            }

            // Check for progress bar gone or 100%
            if (content.includes('100%') || content.includes('已完成')) {
              uploadOk = true;
              logger.info('[Bilibili] Upload complete (progress 100%)');
              break;
            }

            // Check for title/tag input (means upload page fully loaded)
            const titleInput = await page.$('input[placeholder*="标题"], input[placeholder*="title"], .input-val');
            const tagInput = await page.$('input[placeholder*="标签"], input[placeholder*="tag"]');
            if (titleInput || tagInput) {
              // Check if there is NO active upload progress
              const hasProgress = await page.evaluate(() => {
                const progressEl = document.querySelector('.upload-progress, [class*="progress"], [class*="uploading]');
                if (!progressEl) return false;
                const text = progressEl.textContent || '';
                return text.includes('%') && !text.includes('100%') && !text.includes('完成');
              });
              if (!hasProgress) {
                uploadOk = true;
                logger.info('[Bilibili] Upload complete (form ready, no progress)');
                break;
              }
            }

            // On long waits, take periodic screenshots
            if (i > 0 && i % 20 === 0) {
              const ss = path.join(debugDir, 'debug_bili_uploading_' + i + '_' + Date.now() + '.png');
              try { await page.screenshot({ path: ss, fullPage: true }); } catch {}
              logger.info('[Bilibili] Upload progress check ' + (i+1) + '/90, screenshot saved');
            } else if (i % 5 === 0) {
              logger.info('[Bilibili] Upload check ' + (i+1) + '/90');
            }
          } catch (e) {
            if (e.message?.includes('closed')) break;
          }
        }

        if (!uploadOk) {
          const ss = path.join(debugDir, 'debug_bili_upload_timeout_' + Date.now() + '.png');
          try { await page.screenshot({ path: ss, fullPage: true }); } catch {}
          return { success: false, error: '上传超时。截图: ' + ss };
        }
        await randomDelay(2000, 3000);
        // Step 4: Fill title
        logger.info('[Bilibili] Step 4: Fill title...');
        const titleEl = await page.$('input[placeholder*="标题"]');
        if (titleEl) {
          await titleEl.click();
          await titleEl.fill('');
          await titleEl.fill(video.title.substring(0, 80));
          logger.info('[Bilibili] Title set: ' + video.title.substring(0, 80));
        }
        await randomDelay(800, 1200);
        // Step 4.5: Select creation statement - "内容无需标注"
        logger.info('[Bilibili] Step 4.5: Select creation statement...');
        try {
          // Click the creation statement dropdown
          const createDeclInput = await page.$('input.bcc-select-input-inner[placeholder*="创作声明"]');
          if (createDeclInput) {
            await createDeclInput.click();
            await randomDelay(800, 1200);
            // Select "内容无需标注"
            const option = await page.$('text=内容无需标注');
            if (option) {
              await option.click();
              logger.info('[Bilibili] Selected: 内容无需标注');
            } else {
              // Try finding via dropdown items
              const items = await page.$('.bcc-select-dropdown .bcc-select-option, .bcc-select-option');
              for (const item of items) {
                const text = await item.textContent().catch(() => '');
                if (text.includes('无需标注')) {
                  await item.click();
                  logger.info('[Bilibili] Selected via dropdown item');
                  break;
                }
              }
            }
          } else {
            logger.warn('[Bilibili] Creation statement dropdown not found');
          }
        } catch (e) { logger.warn('[Bilibili] Creation statement error: ' + e.message); }
        await randomDelay(800, 1200);

        // Step 5: Fill tags (BEFORE description, since tags are above description)
        // First delete the default "原创" tag
        logger.info('[Bilibili] Step 5: Fill tags...');
        // Delete default tags using backspace (B站 tags are deleted with backspace, not close button)
        try {
          const tagInput = await page.$('input[placeholder*="回车"], input[placeholder*="Enter"], .tag-container input, [class*="tag"] input');
          if (tagInput) {
            await tagInput.click();
            // Press backspace multiple times to delete ALL default tags
            for (let i = 0; i < 6; i++) {
              await page.keyboard.press('Backspace');
              await randomDelay(200, 400);
            }
            logger.info('[Bilibili] Deleted default tags via backspace');
          }
        } catch {}
        await randomDelay(500, 800);

        if (video.tags && video.tags.length > 0) {
          const tagInput = await page.$('input[placeholder*="回车"], input[placeholder*="Enter"], .tag-container input, [class*="tag"] input');
          if (tagInput) {
            for (const tag of video.tags.slice(0, 9)) {
              try {
                await tagInput.click();
                await tagInput.fill('');
                await tagInput.type(tag, { delay: 30 });
                await randomDelay(500, 800);
                await page.keyboard.press('Enter');
                await randomDelay(300, 600);
                logger.info('[Bilibili] Tag added: ' + tag);
              } catch (e) { logger.warn('[Bilibili] Tag error: ' + e.message); }
            }
          } else {
            logger.warn('[Bilibili] Tag input not found');
          }
        }
        await randomDelay(800, 1200);

        // Step 6: Fill description (below tags)
        logger.info('[Bilibili] Step 6: Fill description...');
        const descEl = await page.$('.ql-editor[contenteditable="true"], div.ql-editor, div[contenteditable="true"][data-placeholder], textarea[placeholder*="全面"], textarea[placeholder*="简介"]');
        if (descEl) {
          await descEl.click();
          await randomDelay(300, 500);
          // contenteditable div needs keyboard type, not fill()
          const isContentEditable = await descEl.evaluate(el => el.contentEditable === 'true');
          if (isContentEditable) {
            await page.keyboard.press('Control+a');
            await page.keyboard.press('Backspace');
            await randomDelay(200, 300);
            await page.keyboard.type((video.description || '').substring(0, 2000), { delay: 15 });
          } else {
            await descEl.fill('');
            await descEl.fill((video.description || '').substring(0, 2000));
          }
          logger.info('[Bilibili] Description set');
        } else {
          logger.warn('[Bilibili] Description input not found');
        }
        await randomDelay(800, 1200);

        // Step 7: Click blank area to close dropdowns
        logger.info('[Bilibili] Step 7: Confirm...');
        try { await page.mouse.click(400, 200); } catch {}
        await randomDelay(1000, 1500);

        // Take debug screenshot before submit
        try { await page.screenshot({ path: path.join(debugDir, 'debug_bili_before_submit_' + Date.now() + '.png'), fullPage: true }); } catch {}

        // Step 8: Scroll to bottom and click "立即投稿"
        logger.info('[Bilibili] Step 8: Submit...');
        for (let s2 = 0; s2 < 8; s2++) {
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await randomDelay(400, 700);
        }
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await randomDelay(1500, 2500);

        // Find "立即投稿" button
        let clicked = false;
        const btnPos = await page.evaluate(() => {
          const all = Array.from(document.querySelectorAll('button, [role="button"], a.btn, a, span.submit-add, span[class*="submit"]'));
          // Prefer "立即投稿" exact
          let target = all.find(b => {
            const t = b.textContent?.trim();
            return t === '立即投稿' && b.offsetParent !== null;
          });
          if (!target) {
            target = all.find(b => {
              const t = b.textContent?.trim() || '';
              return t.includes('立即投稿') && b.offsetParent !== null;
            });
          }
          if (!target) {
            target = all.find(b => {
              const t = b.textContent?.trim() || '';
              return (t === '投稿' || t.includes('投稿')) && b.offsetParent !== null;
            });
          }
          if (target) {
            target.scrollIntoView({ block: 'center', behavior: 'smooth' });
            const r = target.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2, text: target.textContent?.trim()?.substring(0, 30) };
          }
          return null;
        });

        if (btnPos) {
          logger.info('[Bilibili] Found button: ' + JSON.stringify(btnPos));
          await randomDelay(1000, 2000);
          // Re-get position after scroll
          const finalPos = await page.evaluate(() => {
            const all = Array.from(document.querySelectorAll('button, [role="button"], a, span.submit-add, span[class*="submit"]'));
            let t = all.find(b => b.textContent?.trim() === '立即投稿' && b.offsetParent !== null);
            if (!t) t = all.find(b => (b.textContent?.trim() || '').includes('立即投稿') && b.offsetParent !== null);
            if (!t) t = all.find(b => (b.textContent?.trim() || '').includes('投稿') && b.offsetParent !== null);
            if (t) {
              const r = t.getBoundingClientRect();
              return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
            }
            return null;
          });
          const cx = finalPos?.x || btnPos.x;
          const cy = finalPos?.y || btnPos.y;
          await page.mouse.click(cx, cy);
          logger.info('[Bilibili] Clicked submit at: x=' + cx + ' y=' + cy);
          clicked = true;
        } else {
          logger.warn('[Bilibili] No submit button found');
        }

        if (!clicked) {
          const ss = path.join(debugDir, 'debug_bili_no_submit_' + Date.now() + '.png');
          await page.screenshot({ path: ss, fullPage: true });
          return { success: false, error: '投稿按钮未找到。截图: ' + ss };
        }

        await randomDelay(3000, 5000);

        // Handle confirmation dialogs
        try {
          for (const sel of ['button:has-text("继续投稿")', 'button:has-text("确定")', 'button:has-text("我知道了")', '.dialog-container button.btn-primary']) {
            try {
              const btn = await page.waitForSelector(sel, { timeout: 3000 });
              if (btn) { await btn.click(); logger.info('[Bilibili] Dialog: ' + sel); break; }
            } catch {}
          }
        } catch {}

        // Step 10: Check result
        logger.info('[Bilibili] Step 10: Check result...');
        let publishSuccess = false;
        let finalUrl = page.url();
        for (let i = 0; i < 20; i++) {
          await sleep(3000);
          try {
            if (page.isClosed()) break;
            const content = await page.evaluate(() => document.body?.innerText || '');
            finalUrl = page.url();
            if (['投稿成功', '稿件投递成功', '稿件提交成功'].some(s => content.includes(s)) || finalUrl.includes('success') || finalUrl.includes('submitted')) {
              publishSuccess = true;
              logger.info('[Bilibili] SUCCESS!');
              break;
            }
            if (['投稿失败', '上传失败'].some(s => content.includes(s))) {
              const ss = path.join(debugDir, 'debug_bili_publish_error_' + Date.now() + '.png');
              await page.screenshot({ path: ss, fullPage: true });
              return { success: false, error: '投稿失败。截图: ' + ss };
            }
            if (i % 5 === 0) logger.info('[Bilibili] Result check ' + (i+1));
          } catch {}
        }

        if (publishSuccess) {
          return { success: true, platform_video_id: 'bili_' + Date.now(), permalink: finalUrl };
        }

        const ss = path.join(debugDir, 'debug_bili_result_' + Date.now() + '.png');
        try { await page.screenshot({ path: ss, fullPage: true }); } catch {}
        return { success: false, error: '投稿结果不确定，请检查B站创作中心。截图: ' + ss };

      } finally {
        if (browser) try { await browser.close(); } catch {}
      }
    } catch (e: any) {
      logger.error('[Bilibili] Publish error:', e);
      return { success: false, error: '发布异常: ' + e.message };
    }
  }

  async fetchStats(data: BilibiliAccountData, platformVideoId: string): Promise<{ views: number; likes: number; comments: number; shares: number }> {
    try {
      const aid = platformVideoId.replace('bili_', '');
      const resp = await biliFetch(`${BILIBILI_API}/x/web-interface/view?aid=${aid}`, data);
      if (resp.code === 0 && resp.data?.stat) {
        const s = resp.data.stat;
        return { views: s.view || 0, likes: s.like || 0, comments: s.reply || 0, shares: s.share || 0 };
      }
      return { views: 0, likes: 0, comments: 0, shares: 0 };
    } catch { return { views: 0, likes: 0, comments: 0, shares: 0 }; }
  }

  async getVideoList(data: BilibiliAccountData): Promise<any[]> {
    try {
      const resp = await biliFetch(`${BILIBILI_API}/x/space/wbi/arc/search?mid=${data.dedeuserid}&ps=30&pn=1`, data);
      if (resp.code === 0 && resp.data?.list?.vlist) {
        return resp.data.list.vlist.map((v: any) => ({
          bvid: v.bvid, aid: v.aid, title: v.title, description: v.description,
          created: v.created, play: v.play, comment: v.comment, pic: v.pic,
        }));
      }
      return [];
    } catch { return []; }
  }
}

export const bilibiliPublisher = new BilibiliPublisher();