# 工时记录助手 · 安卓安装包说明（v1.0）

## 一、文件信息

| 项目 | 内容 |
|---|---|
| 文件名 | `工时记录助手-v1.0.apk` |
| 大小 | 2.8 MB |
| 包名 | `com.worktime.recorder` |
| 版本 | 1.0（versionCode 1） |
| 最低系统 | Android 5.1（API 22） |
| 目标系统 | Android 14（API 34），适配澎湃 OS / HyperOS |
| 签名的 SHA-256 | `A4:2F:7E:C8:6E:E7:EE:64:B7:D7:5D:2A:8A:4C:56:29:FD:12:FD:41:8B:4B:26:A7:16:74:F5:4E:69:B8:76` |
| 文件 SHA-256 | `373814a59512eb5567c1915b62a352e022cf2d560530dda2678ac597b61405ef` |

## 二、红米 K80 Pro 安装步骤

1. 把 `工时记录助手-v1.0.apk` 传到手机（微信文件传输助手 / 数据线 / QQ 均可）
2. 在文件管理里点击该 APK
3. 澎湃 OS 会提示"禁止安装未知来源应用"——点 **设置** → 允许该来源（文件管理 / 微信）安装 → 返回
4. 点 **安装** → 完成后桌面出现"工时记录助手"图标

> 若提示"应用已损坏 / 解析包错误"，说明文件在传输中被改动了，请重新传输，并核对上面的 SHA-256。

## 三、这版 APK 做了什么

- **纯离线**：AndroidManifest 中**未申请任何权限**，无 INTERNET 权限，应用在系统层面就无法联网
- **沉浸式状态栏**：状态栏与页面标题栏同色，无灰色分隔条
- **原生启动页**：蓝底时钟图标，替代白屏
- **无 native 库**：纯 Java/Kotlin 实现，所有 CPU 架构通用，不存在 64 位兼容问题
- **数据存储**：使用 WebView 的 localStorage，等同于浏览器版本

## 四、重要：数据不会自动迁移

APK 版与您之前在浏览器 / 网页版里记录的数据**互相独立**（WebView 有独立存储空间）。

迁移方法：
1. 在网页版「数据」页 → **导出备份文件（JSON）**
2. 在 APK 里「数据」页 → **从备份文件恢复** → 选择该 JSON

## 五、后续升级注意（务必保存）

本 APK 使用自签名证书 `keystore/worktime-release.jks`（位于工程目录）。

**上架小米商店时，必须使用同一份证书签名的 APK。** 如果证书丢失，就无法再更新这个应用，只能换包名重新上架、老用户数据无法迁移。

请立刻备份 `keystore/worktime-release.jks` 和下列口令：
- storePassword：`WorktimeApp2026`
- keyAlias：`worktime`
- keyPassword：`WorktimeApp2026`

> 建议把 keystore 文件存到网盘 / 邮箱，口令另存别处。

## 六、从源码重新构建

工程目录：`工时记录助手-Android/`

```bash
cd 工时记录助手-Android
npm install
npx cap copy android
cd android
export ANDROID_HOME=/opt/android-sdk
./gradlew assembleRelease
# 产物：android/app/build/outputs/apk/release/app-release.apk
```

修改网页代码后，执行第 2 步 `npx cap copy android` 即可把新网页打进 APK。

## 七、距离上架小米商店还差什么

本 APK 已满足技术门槛（targetSdk 34、签名、包名、图标、无越权权限），但商店审核还需下列**人工材料**：

| 材料 | 状态 | 说明 |
|---|---|---|
| 开发者实名认证 | 待办 | dev.xiaomi.com，个人/企业选定后不可改 |
| 软件著作权证书 | 待办 | 30–60 天，名称须与上架名称完全一致 |
| 工信部 APP 备案 | 待办 | 需先有软著，约 20 个工作日 |
| 隐私政策网页 | 待办 | 需独立可访问链接 |
| 4–5 张 1080×1920 截图 | 可代做 | 告诉我即可生成 |
| 应用简介 / 详情描述 | 可代做 | 按小米字数规范撰写 |

> 纯离线工具类应用可豁免 ICP 域名备案，这点对您有利。
