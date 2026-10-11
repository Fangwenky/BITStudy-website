# BITStudy 前端重设计检查

对照 DESIGN_BRIEF.md；2026-10-11。视觉方向：清爽校园产品官网。

## Screenshots Captured

以下截图位于本目录 `screenshots/`，属于本地检查产物，不加入发布包。

| 文件 | 尺寸及状态 |
| --- | --- |
| review-homepage-desktop-1280.png | 1280×800，全页，版本接口失败回退 |
| review-homepage-tablet-768.png | 768×1024，全页，单列布局 |
| review-homepage-mobile-375.png | 375×812，全页，紧凑导航 |
| review-dialog-desktop-1280.png | 1280×800，课程节次原图弹窗 |
| review-dialog-mobile-375.png | 375×812，BITShare 原图弹窗 |

## 结果

首页建立标题、下载按钮、实机界面的清晰层级。功能区改为选择按钮配一张完整截图，解决旧版长截图并排过小、图片重叠及手机布局拥挤的问题。图片源文件保持原始比例，首页仅裁出重点区域，并提供完整原图入口。

手机、平板改用单列布局；桌面使用双列。375px 导航不再换行，320、375、768、1280、1440px 未检测到页面横向溢出。正文保持 16px，辅助元信息使用较小字号；主行动、选择、弹窗关闭按钮有至少 44px 的触控范围。

四项功能的选择状态、说明及截图更新正常，五张原图加载正常。弹窗可滚动，关闭按钮与 Escape 均恢复触发按钮焦点。页面提供语义结构、图片说明、可见键盘焦点与减少动态效果样式。使用原生 HTML/CSS/JS，未增加运行依赖。

本地接口失败状态保留最新安装包链接和 GitHub 发布记录回退；正式环境版本成功状态与 APK 下载在部署后检查。

## Must fix / Should fix

本次检查中发现的手机导航挤压问题已修复，无待处理的阻塞项。

## Could improve

课表截图信息密集，在手机缩略图中个别课程字很小；已提供触控原图查看，保留真实截图内容。

## 验证方式

`verify.sh` 使用 agent-browser 检查五种宽度、四项功能、五张图片、弹窗焦点恢复和 Escape。多步骤 CLI 自动滚动存在竞态，因此功能事件断言集中在一次浏览器求值中执行；尺寸和弹窗同时人工查看截图验证。

## 上线检查

已部署至 https://bitstudy.fangwenky.dpdns.org/。线上浏览器同一套检查通过，无 JavaScript 错误；显示 v1.0.5 / 20.7 MB，按钮指向对应版本的服务器 APK。`/download/latest.apk` 返回 200；版本同步 timer 为 active / enabled。成功状态截图另存为 `screenshots/live-homepage-desktop-1280.png` 和 `screenshots/live-download-desktop-1280.png`。
