import { BasePlatformPublisher, PlatformPublishResult, VideoPublishData } from './base.pub';
import { logger } from '../../utils/logger';

interface DouyinAccountData {
  sessionid: string;
  cookie: string;
}

export class DouyinPublisher extends BasePlatformPublisher {
  platform = 'douyin';

  async validateAccount(data: DouyinAccountData): Promise<{ valid: boolean; nickname?: string; uid?: string; error?: string }> {
    try {
      const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36';
      const resp = await fetch('https://www.douyin.com/aweme/v1/web/query/user/?device_platform=webapp&aid=6383', {
        headers: { 'User-Agent': UA, 'Cookie': data.cookie, 'Referer': 'https://www.douyin.com/' },
        signal: AbortSignal.timeout(10000),
      });
      const json = await resp.json() as any;
      if (json.status_code === 0 && json.user) {
        return { valid: true, nickname: json.user.nickname, uid: json.user.uid || json.user.sec_uid };
      }
      return { valid: false, error: 'Cookie 验证失败（' + (json.status_msg || '未知') + '），请确保已登录' };
    } catch (e: any) {
      return { valid: false, error: '连接失败: ' + e.message };
    }
  }

  async publish(data: DouyinAccountData, video: VideoPublishData): Promise<PlatformPublishResult> {
    let browser = null;
    try {
      logger.info('[Douyin] Publishing video via Playwright: ' + video.title);
      if (!video.videoPath) return { success: false, error: '未提供视频文件' };

      const { chromium } = require('playwright');

      // Parse cookies from string
      const cookies = this.parseCookies(data.cookie);

      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
      });

      // Set cookies
      const playwrightCookies = cookies.map(function(c) {
        return {
          name: c.name,
          value: c.value,
          domain: '.douyin.com',
          path: '/',
        };
      });
      await context.addCookies(playwrightCookies);

      const page = await context.newPage();

      // Navigate to creator page
      logger.info('[Douyin] Navigating to creator.douyin.com...');
      await page.goto('https://creator.douyin.com/creator-micro/content/upload', {
        waitUntil: 'networkidle',
        timeout: 30000,
      });

      // Check if redirected to login page
      const currentUrl = page.url();
      if (currentUrl.includes('login') || currentUrl.includes('passport')) {
        logger.error('[Douyin] Redirected to login page: ' + currentUrl);
        return { success: false, error: 'Cookie 已失效，请重新绑定抖音账号（被重定向到登录页）' };
      }

      logger.info('[Douyin] Page loaded: ' + currentUrl);

      // Wait for page to fully load
      await page.waitForTimeout(3000);

      // Take screenshot for debugging
      const screenshotPath = require('os').tmpdir() + '/douyin_debug_' + Date.now() + '.png';
      await page.screenshot({ path: screenshotPath, fullPage: true });
      logger.info('[Douyin] Debug screenshot saved: ' + screenshotPath);

      // Log all input elements on the page
      const inputCount = await page.$eval('input', function(inputs: any) { return inputs.length; });
      logger.info('[Douyin] Found ' + inputCount + ' input elements on page');

      // Look for upload input (may be hidden)
      logger.info('[Douyin] Looking for upload input...');
      let fileInput = await page.$('input[type="file"]');
      if (!fileInput) {
        // Try to find and click upload area to trigger file input
        logger.info('[Douyin] No file input found, looking for upload button...');
        const uploadArea = await page.$('[class*="upload"], [class*="Upload"], [data-testid*="upload"], button:has-text("上传")');
        if (uploadArea) {
          await uploadArea.click();
          await page.waitForTimeout(2000);
          fileInput = await page.$('input[type="file"]');
        }
      }
      if (!fileInput) {
        // Dump page content for debugging
        const bodyText = await page.innerText('body').catch(function() { return 'unable to get text'; });
        logger.error('[Douyin] Page content (first 500): ' + bodyText.slice(0, 500));
        return { success: false, error: '找不到上传按钮，请检查抖音创作者后台页面是否正常' };
      }

      // Resolve video file path
      const fs2 = require('fs');
      const path2 = require('path');
      let filePath = video.videoPath;
      if (filePath.startsWith('http')) {
        // Download the file first
        logger.info('[Douyin] Downloading video from URL...');
        const dlResp = await fetch(filePath, { signal: AbortSignal.timeout(120000) });
        const buffer = Buffer.from(await dlResp.arrayBuffer());
        filePath = path2.join(require('os').tmpdir(), 'douyin_upload_' + Date.now() + '.mp4');
        fs2.writeFileSync(filePath, buffer);
      } else if (!filePath.startsWith('/') && !filePath.match(/^[A-Z]:/i)) {
        filePath = path2.join(process.cwd(), filePath);
      }

      if (!fs2.existsSync(filePath)) {
        return { success: false, error: '视频文件不存在: ' + filePath };
      }

      // Upload video file
      logger.info('[Douyin] Uploading video file: ' + filePath);
      await fileInput.setInputFiles(filePath);

      // Take screenshot after file selection
      await page.screenshot({ path: screenshotPath }).catch(function() {});
      logger.info('[Douyin] Screenshot saved after file input set');

      // Handle dialog popup - douyin shows a confirmation dialog after file upload
      logger.info('[Douyin] Looking for upload confirmation dialog...');
      await page.waitForTimeout(3000);

      // Try to find and click "确定" (confirm) button in the dialog
      try {
        const confirmBtn = await page.waitForSelector('button:has-text("确定")', { timeout: 10000 });
        if (confirmBtn) {
          logger.info('[Douyin] Found confirm button, clicking...');
          await confirmBtn.click();
          await page.waitForTimeout(2000);
        }
      } catch (e) {
        logger.info('[Douyin] No confirm dialog found, continuing...');
      }

      // Take another screenshot
      await page.screenshot({ path: screenshotPath }).catch(function() {});
      logger.info('[Douyin] Screenshot saved after dialog handling');

      // Wait for upload to complete (look for success indicator or progress bar)
      logger.info('[Douyin] Waiting for upload to complete...');
      try {
        await page.waitForFunction(
          "document.body.innerText.includes('上传成功') || document.body.innerText.includes('更换视频') || document.body.innerText.includes('重新上传') || document.body.innerText.includes('封面') || document.body.innerText.includes('发布')",
          { timeout: 120000 }
        );
        logger.info('[Douyin] Upload completion detected');
      } catch (e) {
        logger.warn('[Douyin] Upload timeout, continuing anyway...');
      }

      // Take screenshot after upload
      await page.screenshot({ path: screenshotPath }).catch(function() {});
      logger.info('[Douyin] Screenshot saved after upload wait');

      // Fill in title if there's a title input
      logger.info('[Douyin] Filling title and description...');
      try {
        // Try multiple selectors for title input
        const titleSelectors = [
          'input[placeholder*="标题"]',
          'input[placeholder*="title"]',
          'input[data-testid*="title"]',
          '.title-input input',
          'input[maxlength="30"]',
        ];
        let titleInput = null;
        for (const sel of titleSelectors) {
          titleInput = await page.$(sel);
          if (titleInput) {
            logger.info('[Douyin] Found title input with selector: ' + sel);
            break;
          }
        }
        if (titleInput) {
          await titleInput.click();
          await titleInput.fill('');
          await titleInput.fill(video.title.slice(0, 30));
          logger.info('[Douyin] Title filled: ' + video.title.slice(0, 30));
        } else {
          logger.warn('[Douyin] No title input found');
        }

        // Try to find description/content editor and fill it
        const descSelectors = [
          '[contenteditable="true"]',
          '.ql-editor',
          '[data-testid*="desc"]',
          'textarea[placeholder*="描述"]',
          'textarea[placeholder*="简介"]',
        ];
        let descEditor = null;
        for (const sel of descSelectors) {
          descEditor = await page.$(sel);
          if (descEditor) {
            logger.info('[Douyin] Found desc editor with selector: ' + sel);
            break;
          }
        }
        if (descEditor) {
          await descEditor.click();
          await page.keyboard.type((video.description || video.title).slice(0, 200));
          logger.info('[Douyin] Description filled');
        }
      } catch (e) {
        logger.warn('[Douyin] Failed to fill title/desc: ' + (e as Error).message);
      }

      // Take screenshot before publish
      await page.screenshot({ path: screenshotPath }).catch(function() {});

      // Click publish button
      logger.info('[Douyin] Looking for publish button...');
      try {
        const publishBtn = await page.waitForSelector('button:has-text("发布"), button:has-text("发布视频")', { timeout: 10000 });
        if (publishBtn) {
          await publishBtn.click();
          logger.info('[Douyin] Publish button clicked');
        }
      } catch (e) {
        logger.warn('[Douyin] Publish button not found, trying alternative...');
        const buttons = await page.$$('button');
        for (const btn of buttons) {
          const text = await btn.innerText().catch(function() { return ''; });
          if (text.includes('发布') && !text.includes('取消')) {
            await btn.click();
            logger.info('[Douyin] Clicked button: ' + text);
            break;
          }
        }
      }

      // Wait for publish success
      logger.info('[Douyin] Waiting for publish confirmation...');
      await page.waitForTimeout(5000);

      // Take final screenshot
      await page.screenshot({ path: screenshotPath }).catch(function() {});

      const finalUrl = page.url();
      const finalText = await page.innerText('body').catch(function() { return ''; });
      logger.info('[Douyin] Final URL: ' + finalUrl);
      logger.info('[Douyin] Final page text (first 300): ' + finalText.slice(0, 300));

      if (finalText.includes('发布成功') || finalText.includes('已发布') || finalUrl.includes('publishSuccess')) {
        logger.info('[Douyin] Publish success!');
        return { success: true, permalink: finalUrl };
      }

      if (finalText.includes('失败') || finalText.includes('错误')) {
        logger.error('[Douyin] Publish failed on page');
        return { success: false, error: '发布失败，页面显示错误信息' };
      }

      logger.info('[Douyin] Publish completed (no explicit success/failure indicator)');
      return { success: true, permalink: finalUrl };

    } catch (e: any) {
      logger.error('[Douyin] Publish error:', e);
      return { success: false, error: '发布异常: ' + e.message };
    } finally {
      if (browser) {
        try { await browser.close(); } catch {}
      }
    }
  }

  async fetchStats(data: DouyinAccountData, platformVideoId: string): Promise<{ views: number; likes: number; comments: number; shares: number }> {
    try {
      const resp = await fetch('https://www.douyin.com/aweme/v1/web/aweme/detail/?aweme_id=' + platformVideoId + '&device_platform=webapp&aid=6383', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Cookie': data.cookie, 'Referer': 'https://www.douyin.com/' },
        signal: AbortSignal.timeout(10000),
      });
      const json = await resp.json() as any;
      const stat = json.aweme_detail?.statistics;
      if (stat) return { views: stat.play_count || 0, likes: stat.digg_count || 0, comments: stat.comment_count || 0, shares: stat.share_count || 0 };
      return { views: 0, likes: 0, comments: 0, shares: 0 };
    } catch { return { views: 0, likes: 0, comments: 0, shares: 0 }; }
  }

  private parseCookies(cookieStr: string): Array<{ name: string; value: string }> {
    const cookies: Array<{ name: string; value: string }> = [];
    const parts = cookieStr.split(';');
    for (const part of parts) {
      const trimmed = part.trim();
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex > 0) {
        const name = trimmed.substring(0, eqIndex).trim();
        const value = trimmed.substring(eqIndex + 1).trim();
        if (name) {
          cookies.push({ name: name, value: value });
        }
      }
    }
    return cookies;
  }
}

export const douyinPublisher = new DouyinPublisher();
