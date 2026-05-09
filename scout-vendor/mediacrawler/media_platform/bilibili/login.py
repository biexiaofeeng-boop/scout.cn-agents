# -*- coding: utf-8 -*-
# Copyright (c) 2025 relakkes@gmail.com
#
# This file is part of MediaCrawler project.
# Repository: https://github.com/NanmiCoder/MediaCrawler/blob/main/media_platform/bilibili/login.py
# GitHub: https://github.com/NanmiCoder
# Licensed under NON-COMMERCIAL LEARNING LICENSE 1.1
#

# 声明：本代码仅供学习和研究目的使用。使用者应遵守以下原则：
# 1. 不得用于任何商业用途。
# 2. 使用时应遵守目标平台的使用条款和robots.txt规则。
# 3. 不得进行大规模爬取或对平台造成运营干扰。
# 4. 应合理控制请求频率，避免给目标平台带来不必要的负担。
# 5. 不得用于任何非法或不当的用途。
#
# 详细许可条款请参阅项目根目录下的LICENSE文件。
# 使用本代码即表示您同意遵守上述原则和LICENSE中的所有条款。


# -*- coding: utf-8 -*-
# @Author  : relakkes@gmail.com
# @Time    : 2023/12/2 18:44
# @Desc    : bilibili login implementation class

import asyncio
import functools
from typing import Optional

from playwright.async_api import BrowserContext, Page
from tenacity import (RetryError, retry, retry_if_result, stop_after_attempt,
                      wait_fixed)

import config
from base.base_crawler import AbstractLogin
from tools import utils


class BilibiliLogin(AbstractLogin):
    LOGIN_PANEL_SELECTORS = (
        "css=.login-panel-popover",
        "css=.login-scan-box img",
        "text=扫描二维码登录",
        "text=扫码登录",
    )

    LOGIN_TRIGGER_SELECTORS = (
        "css=.login-btn",
        "css=.right-entry__outside.go-login-btn",
        "css=.header-login-entry",
        "text=立即登录",
        "text=登录",
    )

    QRCODE_SELECTORS = (
        "css=.login-scan-box img",
        "css=img[alt*='二维码']",
        "xpath=//div[contains(@class, 'login-scan-box')]//img",
        "xpath=//img[contains(@src, 'data:image/png;base64')]",
    )

    def __init__(self,
                 login_type: str,
                 browser_context: BrowserContext,
                 context_page: Page,
                 login_phone: Optional[str] = "",
                 cookie_str: str = ""
                 ):
        config.LOGIN_TYPE = login_type
        self.browser_context = browser_context
        self.context_page = context_page
        self.login_phone = login_phone
        self.cookie_str = cookie_str

    async def begin(self):
        """Start login bilibili"""
        utils.logger.info("[BilibiliLogin.begin] Begin login Bilibili ...")
        if config.LOGIN_TYPE == "qrcode":
            await self.login_by_qrcode()
        elif config.LOGIN_TYPE == "phone":
            await self.login_by_mobile()
        elif config.LOGIN_TYPE == "cookie":
            await self.login_by_cookies()
        else:
            raise ValueError(
                "[BilibiliLogin.begin] Invalid Login Type Currently only supported qrcode or phone or cookie ...")

    @retry(stop=stop_after_attempt(600), wait=wait_fixed(1), retry=retry_if_result(lambda value: value is False))
    async def check_login_state(self) -> bool:
        """
            Check if the current login status is successful and return True otherwise return False
            retry decorator will retry 20 times if the return value is False, and the retry interval is 1 second
            if max retry times reached, raise RetryError
        """
        current_cookie = await self.browser_context.cookies()
        _, cookie_dict = utils.convert_cookies(current_cookie)
        if cookie_dict.get("SESSDATA", "") or cookie_dict.get("DedeUserID"):
            return True
        return False

    async def _wait_for_any_selector(self, selectors: tuple[str, ...], timeout_ms: int) -> bool:
        for selector in selectors:
            try:
                await self.context_page.wait_for_selector(selector, state="visible", timeout=timeout_ms)
                return True
            except Exception:
                continue
        return False

    async def _open_login_surface(self) -> None:
        if await self._wait_for_any_selector(self.LOGIN_PANEL_SELECTORS, timeout_ms=2_000):
            return

        for selector in self.LOGIN_TRIGGER_SELECTORS:
            locator = self.context_page.locator(selector)
            try:
                if await locator.count() == 0:
                    continue
                await locator.first.click(timeout=5_000)
                await asyncio.sleep(1)
                if await self._wait_for_any_selector(self.LOGIN_PANEL_SELECTORS, timeout_ms=5_000):
                    return
            except Exception as e:
                utils.logger.warning(
                    "[BilibiliLogin._open_login_surface] trigger failed selector=%s error=%s",
                    selector,
                    e,
                )
                continue

        raise RuntimeError("[BilibiliLogin._open_login_surface] failed to open bilibili login surface")

    async def login_by_qrcode(self):
        """login bilibili website and keep webdriver login state"""
        utils.logger.info("[BilibiliLogin.login_by_qrcode] Begin login bilibili by qrcode ...")

        await self._open_login_surface()

        base64_qrcode_img = ""
        for selector in self.QRCODE_SELECTORS:
            base64_qrcode_img = await utils.find_login_qrcode(self.context_page, selector=selector)
            if base64_qrcode_img:
                break
        if not base64_qrcode_img:
            raise RuntimeError("[BilibiliLogin.login_by_qrcode] login failed, qrcode not found")

        # show login qrcode
        partial_show_qrcode = functools.partial(utils.show_qrcode, base64_qrcode_img)
        asyncio.get_running_loop().run_in_executor(executor=None, func=partial_show_qrcode)

        utils.logger.info(f"[BilibiliLogin.login_by_qrcode] Waiting for scan code login, remaining time is 20s")
        try:
            await self.check_login_state()
        except RetryError:
            raise RuntimeError("[BilibiliLogin.login_by_qrcode] Login bilibili failed by qrcode login method")

        wait_redirect_seconds = 5
        utils.logger.info(
            f"[BilibiliLogin.login_by_qrcode] Login successful then wait for {wait_redirect_seconds} seconds redirect ...")
        await asyncio.sleep(wait_redirect_seconds)

    async def login_by_mobile(self):
        pass

    async def login_by_cookies(self):
        utils.logger.info("[BilibiliLogin.login_by_qrcode] Begin login bilibili by cookie ...")
        for key, value in utils.convert_str_cookie_to_dict(self.cookie_str).items():
            await self.browser_context.add_cookies([{
                'name': key,
                'value': value,
                'domain': ".bilibili.com",
                'path': "/"
            }])
