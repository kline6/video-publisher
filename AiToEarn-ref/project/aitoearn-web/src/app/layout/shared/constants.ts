/**
 * 导航共享常量
 * MobileNav �?LayoutSidebar 共用的常量配�?
 */

import { isChina } from '@/constant'

/** GitHub 仓库地址 */
export const GITHUB_REPO = ''

/** 文档网站地址 */
export const DOCS_URL = 'https://docs.VideoFlow.ai'

/** 站点切换地址 */
export const SITE_SWITCH_URL = isChina
  ? process.env.NEXT_PUBLIC_ABROAD_DOMAIN || 'https://VideoFlow.ai/'
  : process.env.NEXT_PUBLIC_CHINA_DOMAIN || 'https://VideoFlow.cn/'

/** 站点切换文案 key */
export const SITE_SWITCH_TRANSLATION_KEY = isChina ? 'switchToInternational' : 'switchToChina'

/**
 * 导航菜单分组配置
 * MobileNav �?"More" 折叠菜单包含的路由项
 */
export const NAV_GROUP_KEYS = [
  'tasksHistory',
  'header.materialLibrary',
] as const
