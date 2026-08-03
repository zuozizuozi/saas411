# seedance.co 产品交付蓝图

更新日期：2026-08-03

## 1. Product

seedance.co 是面向普通创作者的 AI 视频生成 SaaS。首发产品以 Seedance 系列为核心，用户注册后通过预充值积分或订阅获得积分，再按实际生成配置扣费。

首发模型目录：

| 模型 | 状态 | 定位 | 原生时长 | 首发模式 |
| --- | --- | --- | --- | --- |
| Seedance 2.0 Mini | Active / Recommended | 低成本、快速预览 | 4–15 秒 | 文生视频、图生视频 |
| Seedance 2.0 | Active / Pro | 高质量主力模型 | 4–15 秒 | 文生视频、图生视频 |
| Seedance 1.5 Pro | Active | 稳定备用与能力补充 | 4–12 秒 | 文生视频、图生视频、首尾帧 |
| Seedance 2.5 | Coming Soon | 后续升级位 | 未验证，不作承诺 | 不可选择、不可提交 |

核心原则：模型名称、状态、能力、供应商路由和计费规则都从配置读取；前端不硬编码模型条件。

## 2. MVP Boundary

### 首发必须完成

- 模型下拉框展示三个可用模型和一个禁用的 Seedance 2.5 Coming Soon。
- 用户必须登录才能提交生成。
- 新用户注册不赠送积分。
- 用户必须通过预充值或订阅获得积分；提交前必须有足够可用积分。
- 时长、分辨率、比例、图片数量、音频开关随所选模型动态变化。
- 提交前展示预计消耗；提交时冻结积分，成功结算，失败释放。
- 后端再次校验模型能力和价格，不能信任前端参数。

### 首发明确不做

- 不把所有模型统一包装成 5–30 秒。
- 不用自动续写、拼接或插帧伪装成原生长视频。
- 不开放 Seedance 2.5，也不展示未经实测的价格、4K、30 秒等承诺。
- 不提供“无限生成”订阅；订阅必须发放有限积分。
- 不在本阶段接参考视频、多素材参考等尚未完整验证的高级模式。

## 3. Critical Flows

### 访客到生成

1. 访客可以浏览、选择模型和填写参数。
2. 点击生成时若未登录，进入登录/注册流程。
3. 新注册账户余额为 0。
4. 登录后若余额为 0，展示“充值积分 / 订阅”付费门槛。
5. 若余额低于预计消耗，返回明确的所需积分、可用积分及购买入口。
6. 余额充足时冻结积分并提交供应商任务。
7. 生成成功后结算冻结积分；失败、超时或供应商拒绝时释放积分。

### 模型选择

1. 页面加载公开模型目录。
2. Active 模型可选；Coming Soon 模型可见但禁用。
3. 切换模型后，控件按能力注册表重新计算：时长范围、画质、比例、图片数量、音频能力。
4. 当前参数不被新模型支持时，自动切换到该模型默认值并提示用户。
5. 提交时服务端使用同一份能力注册表复核。

## 4. Page and Component Map

- 营销首页与工具页：删除“免费额度”“免费生成”等承诺；CTA 改为“创建账户”。
- 生成器：
  - `ModelSelector`：配置驱动的模型下拉框，含徽标、状态和禁用态。
  - `CapabilityControls`：动态时长、分辨率、比例、图片槽和音频开关。
  - `CostEstimate`：显示预计站内积分，不直接向用户暴露供应商成本。
  - `PaymentGate`：零余额或余额不足时提供充值/订阅入口。
- 定价页：同时解释预充值积分包和订阅所含积分，不出现无限使用表述。
- 账户页：展示可用、冻结和已使用积分，以及订阅状态。

## 5. Architecture Boundary

### 模型目录与运行目录分离

新增统一模型注册表，建议字段：

```ts
type ModelAvailability = "active" | "coming_soon" | "hidden";

interface VideoModelDefinition {
  id: string;
  name: string;
  availability: ModelAvailability;
  badge?: string;
  sortOrder: number;
  modes: Array<"text-to-video" | "image-to-video" | "first-last-frame">;
  durations: number[];
  resolutions: string[];
  aspectRatios: string[];
  imageInputs: { min: number; max: number };
  audio: { supported: boolean; extraCost: boolean };
  defaultProvider?: string;
  providerRoutes: Record<string, string>;
  pricingRuleId?: string;
}
```

- `getModelCatalog()` 返回 Active 和 Coming Soon，供前端展示。
- `getRunnableModels()` 只返回 Active 且具备可用供应商映射的模型。
- Coming Soon 条目不能进入生成 API，也不能参与价格计算。
- 供应商模型 ID 只存在于路由映射，不散落在组件或服务中。

### 时长策略

- 取消全局 5–30 秒产品承诺。
- 前端时长控件读取当前模型的离散/连续原生范围。
- 后端 Zod 只做安全上限，随后按模型能力进行精确校验。
- 首发不做续写。如果将来加入，作为独立 `generationMode: "extend"`、独立定价和独立质量提示，不能静默拼接。

### 付费访问

- 关闭 `NEW_USER_GIFT`，建议设置 `enabled: false`、`credits: 0`；现有登录后赠送 hook 可保留为配置化 no-op。
- 保留现有 `requireAuth`、积分冻结/结算/释放链路。
- 内部 `FREE` 计划可暂时保留，含义改为“无订阅用户”；前台名称使用 Pay-as-you-go / 按量付费。
- 已经发给老账户的注册送积分不自动追回，除非上线前另行执行经过确认的定向清理。

## 6. Data and Integrations

- AI 供应商：EvoLink 为首发主路由；每个模型必须先完成真实 API 冒烟测试再设为 Active。
- 数据库：现有用户、积分包、冻结记录、交易记录和视频任务表可复用；本阶段不要求为了关闭赠送积分做迁移。
- 支付：预充值与订阅最终都落到积分包，生成服务只认可用积分余额。
- 存储：延续供应商结果下载、R2 持久化和 CDN 展示链路。
- 机密：API Key 仅存 Vercel 服务端环境变量，绝不进入 `NEXT_PUBLIC_*` 或客户端响应。

## 7. Delivery Setup

- 开发环境先使用 EvoLink 测试 Key 和独立回调地址。
- Preview 与 Production 使用不同 Key（若供应商账户支持）。
- 正式发布前确认 Vercel 环境变量、回调域名、R2 跨域、支付 Webhook 和数据库连接。
- 模型启用必须是配置变更；未配置真实供应商路由时保持 Coming Soon/Hidden。

## 8. Verification

### 自动化验证

- 单元测试：三款模型的合法/非法时长、分辨率、比例、图片数量和音频参数。
- 单元测试：Coming Soon、Hidden、无供应商映射模型无法提交。
- 单元测试：零余额、余额不足、冻结、成功结算和失败释放。
- API 测试：未登录 401、余额不足 402、非法能力参数 400、供应商错误不扣款。
- UI 测试：切换模型后控件和默认值正确；Seedance 2.5 可见但不可点击。

### 上线前人工验证

- 新邮箱注册后余额确认为 0，页面没有免费额度文案。
- 充值和订阅各完成一次，积分到账且可追溯。
- 三个模型分别完成一次文本生成和一组核心图生视频测试。
- 对照 EvoLink 账单核验供应商成本、站内积分冻结和最终结算。
- 生成失败、超时和回调重复时不产生重复扣费。

## 9. Delivery Sequence

1. 建立统一模型能力注册表，并补齐三款模型的供应商路由。
2. 改造模型下拉框和动态能力控件，加入 Seedance 2.5 Coming Soon。
3. 关闭注册送积分并清理所有免费额度文案。
4. 完成生成 API 的模型能力复核和价格规则矩阵。
5. 接通三款真实模型，逐一做 API 冒烟测试和账单核验。
6. 完成登录、充值/订阅、生成、回调、存储、展示和退款式释放的全链路回归。
7. Preview 验收通过后再发布 Production。

## 10. Template Extraction

以下部分可长期复用：

- 模型状态、能力和供应商路由分离的注册表。
- 登录门槛、余额门槛和支付门槛组件。
- 预计积分、冻结、结算、失败释放的计费链路。
- Coming Soon 到 Active 的配置化发布流程。

Seedance 专属内容仅保留在模型定义和供应商适配器中，未来增加可灵、MiniMax 等模型时不修改生成器主流程。
