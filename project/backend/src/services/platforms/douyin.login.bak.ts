// @ts-nocheck
import { logger } from '../../utils/logger';

export interface DouyinLoginResult {
  success: boolean;
  cookie?: string;
  tokens?: { privateKey: string; webProtect: string };
  userInfo?: { nickname: string; uid: string; avatar?: string };
  error?: string;
}

export async function douyinScanLogin(): Promise<DouyinLoginResult> {
  let browser = null;
  try {
    const { chromium } = require('playwright');

    browser = await chromium.launch({
      channel: 'chrome',
      headless: false,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--window-size=1280,800',
      ],
    });

    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    const page = await context.newPage();

    logger.info('[DouyinLogin] Opening creator.douyin.com for QR login...');
    await page.goto('https://creator.douyin.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    // Step 1: Wait for login (page redirects away from login)
    logger.info('[DouyinLogin] Waiting for user to scan QR code...');
    await page.waitForFunction(
      () => {
        const url = window.location.href;
        if (url.includes('passport') || url.includes('login')) return false;
        const body = document.body?.innerText || '';
        return (
          body.includes('\u521b\u4f5c\u8005') ||
          body.includes('\u9996\u9875') ||
          body.includes('\u5185\u5bb9\u7ba1\u7406') ||
          url.includes('creator-micro')
        );
      },
      { timeout: 180000 }
    );

    logger.info('[DouyinLogin] Login detected, waiting for page to fully load...');

    // Step 2: Wait extra time for localStorage to be fully initialized
    // The security-sdk tokens take a few seconds to be written after page load
    await page.waitForTimeout(5000);

    // Step 3: Try to wait for localStorage tokens with retries
    let tokens: { privateKey: string; webProtect: string } | undefined;
    for (let attempt = 0; attempt < 6; attempt++) {
      const tokenData = await page.evaluate(() => {
        try {
          const sdkData = localStorage.getItem('security-sdk/s_sdk_crypt_sdk');
          const protectData = localStorage.getItem('security-sdk/s_sdk_sign_data_key/web_protect');
          let privateKey = '';
          let webProtect = '';

          if (sdkData) {
            try {
              const parsed = JSON.parse(sdkData);
              const inner = JSON.parse(parsed.data);
              privateKey = inner.ec_privateKey || '';
            } catch {}
          }
          if (protectData) {
            try {
              const parsed = JSON.parse(protectData);
              webProtect = parsed.data || '';
            } catch {
              webProtect = protectData;
            }
          }
          return { privateKey, webProtect, sdkExists: !!sdkData, protectExists: !!protectData };
        } catch (e) {
          return { privateKey: '', webProtect: '', sdkExists: false, protectExists: false };
        }
      });

      logger.info('[DouyinLogin] Token check attempt ' + (attempt + 1) + ': privateKey=' + !!tokenData.privateKey + ' webProtect=' + !!tokenData.webProtect + ' sdkExists=' + tokenData.sdkExists + ' protectExists=' + tokenData.protectExists);

      if (tokenData.privateKey && tokenData.webProtect) {
        tokens = tokenData;
        logger.info('[DouyinLogin] localStorage tokens captured successfully');
        break;
      }

      // Wait 2s before retrying
      await page.waitForTimeout(2000);
    }

    if (!tokens) {
      logger.warn('[DouyinLogin] Could not capture full localStorage tokens after retries');
    }

    // Step 4: Extract cookies (fixed filter)
    const allCookies = await context.cookies();
    const douyinCookies = allCookies.filter((c) =>
      c.domain.includes('douyin.com') || c.domain.includes('bytedance.com')
    );
    const cookieString = douyinCookies
      .map((c) => c.name + '=' + c.value)
      .join('; ');
    logger.info('[DouyinLogin] Captured ' + douyinCookies.length + ' cookies');

    // Step 5: Get user info
    let userInfo: { nickname: string; uid: string; avatar?: string } | undefined;
    try {
      const resp = await page.evaluate(async (cookie: string) => {
        const r = await fetch(
          'https://creator.douyin.com/web/api/media/user/info/',
          { headers: { Cookie: cookie } }
        );
        return r.json();
      }, cookieString);

      if (resp && resp.status_code === 0 && resp.user) {
        userInfo = {
          nickname: resp.user.nickname || '\u6296\u97f3\u7528\u6237',
          uid: resp.user.uid || resp.user.sec_uid || '',
          avatar: resp.user.avatar || '',
        };
        logger.info('[DouyinLogin] User: ' + userInfo.nickname + ' uid=' + userInfo.uid);
      }
    } catch (e: any) {
      logger.warn('[DouyinLogin] Failed to get user info: ' + e.message);
    }

    if (!cookieString) {
      return { success: false, error: '\u672a\u80fd\u83b7\u53d6\u5230 Cookie' };
    }

    return {
      success: true,
      cookie: cookieString,
      tokens: tokens,
      userInfo: userInfo || { nickname: '\u6296\u97f3\u7528\u6237', uid: 'unknown' },
    };
  } catch (e: any) {
    logger.error('[DouyinLogin] Error:', e);
    return { success: false, error: '\u767b\u5f55\u6d41\u7a0b\u5f02\u5e38: ' + e.message };
  } finally {
    if (browser) {
      try { await browser.close(); } catch {}
    }
  }
}
