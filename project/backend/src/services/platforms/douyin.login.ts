// @ts-nocheck
import { logger } from '../../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

const STORAGE_DIR = path.join(process.cwd(), 'storage_states');

export interface DouyinLoginResult {
  success: boolean;
  cookie?: string;
  tokens?: { privateKey: string; webProtect: string };
  storageStatePath?: string;
  userInfo?: { nickname: string; uid: string; avatar?: string };
  error?: string;
}

export async function douyinScanLogin(): Promise<DouyinLoginResult> {
  let browser = null;
  try {
    const { chromium } = require('playwright');

    // Ensure storage_states directory exists
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }

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
          body.includes('创作者') ||
          body.includes('首页') ||
          body.includes('内容管理') ||
          url.includes('creator-micro')
        );
      },
      { timeout: 180000 }
    );

    logger.info('[DouyinLogin] Login detected, waiting for page to fully load...');

    // Step 2: Wait extra time for localStorage to be fully initialized
    await page.waitForTimeout(8000);

    // Step 3: Navigate to upload page to trigger security SDK initialization
    logger.info('[DouyinLogin] Navigating to upload page to trigger SDK init...');
    await page.goto('https://creator.douyin.com/creator-micro/content/upload', {
      waitUntil: 'networkidle',
      timeout: 30000,
    }).catch(() => {});
    await page.waitForTimeout(5000);

    // Step 4: Try to wait for localStorage tokens with retries
    let tokens: { privateKey: string; webProtect: string } | undefined;
    for (let attempt = 0; attempt < 8; attempt++) {
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

      logger.info('[DouyinLogin] Token check attempt ' + (attempt + 1) + ': privateKey=' + !!tokenData.privateKey + ' webProtect=' + !!tokenData.webProtect);

      if (tokenData.privateKey && tokenData.webProtect) {
        tokens = tokenData;
        logger.info('[DouyinLogin] localStorage tokens captured successfully');
        break;
      }

      await page.waitForTimeout(3000);
    }

    // Step 5: Save full storageState (cookies + localStorage) to file
    const storageStatePath = path.join(STORAGE_DIR, 'douyin_' + Date.now() + '.json');
    try {
      const storageState = await context.storageState();
      
      // Also inject localStorage data if we got tokens
      if (tokens) {
        // We need to add localStorage items to the storage state
        // Playwright's storageState() captures cookies and localStorage from all pages visited
        // But we need to make sure the security SDK data is in there
        const stateObj = JSON.parse(storageState);
        
        // Add localStorage entries for the creator.douyin.com origin
        if (stateObj.origins) {
          const douyinOrigin = stateObj.origins.find((o: any) => o.origin.includes('douyin.com'));
          if (douyinOrigin) {
            // Check if security-sdk data already exists
            const hasSsdk = douyinOrigin.localStorage?.some((l: any) => l.name.includes('security-sdk'));
            if (!hasSsdk && tokens) {
              douyinOrigin.localStorage = douyinOrigin.localStorage || [];
              douyinOrigin.localStorage.push({
                name: 'security-sdk/s_sdk_crypt_sdk',
                value: JSON.stringify({ data: JSON.stringify({ ec_privateKey: tokens.privateKey }) })
              });
              douyinOrigin.localStorage.push({
                name: 'security-sdk/s_sdk_sign_data_key/web_protect',
                value: JSON.stringify({ data: tokens.webProtect })
              });
            }
          }
        }
        
        fs.writeFileSync(storageStatePath, JSON.stringify(stateObj, null, 2));
        logger.info('[DouyinLogin] StorageState saved to: ' + storageStatePath);
      } else {
        fs.writeFileSync(storageStatePath, storageState);
        logger.info('[DouyinLogin] StorageState saved (without tokens): ' + storageStatePath);
      }
    } catch (e: any) {
      logger.warn('[DouyinLogin] Failed to save storageState: ' + e.message);
    }

    // Step 6: Extract cookies
    const allCookies = await context.cookies();
    const douyinCookies = allCookies.filter((c) =>
      c.domain.includes('douyin.com') || c.domain.includes('bytedance.com')
    );
    const cookieString = douyinCookies
      .map((c) => c.name + '=' + c.value)
      .join('; ');
    logger.info('[DouyinLogin] Captured ' + douyinCookies.length + ' cookies');

    // Step 7: Get user info
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
          nickname: resp.user.nickname || '抖音用户',
          uid: resp.user.uid || resp.user.sec_uid || '',
          avatar: resp.user.avatar || '',
        };
        logger.info('[DouyinLogin] User: ' + userInfo.nickname + ' uid=' + userInfo.uid);
      }
    } catch (e: any) {
      logger.warn('[DouyinLogin] Failed to get user info: ' + e.message);
    }

    if (!cookieString) {
      return { success: false, error: '未能获取到 Cookie' };
    }

    return {
      success: true,
      cookie: cookieString,
      tokens: tokens,
      storageStatePath: storageStatePath,
      userInfo: userInfo || { nickname: '抖音用户', uid: 'unknown' },
    };
  } catch (e: any) {
    logger.error('[DouyinLogin] Error:', e);
    return { success: false, error: '登录流程异常: ' + e.message };
  } finally {
    if (browser) {
      try { await browser.close(); } catch {}
    }
  }
}
