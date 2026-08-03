interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

export const priceFaqDataMap: Record<string, FAQItem[]> = {
  zh: [
    {
      id: "item-1",
      question: "积分如何计费？",
      answer:
        "每次生成前都会显示预计积分消耗。实际消耗由所选 Seedance 模型、时长、分辨率和生成数量决定；生成失败时，已冻结的积分会自动返还。",
    },
    {
      id: "item-2",
      question: "Go、Plus 和 Pro 有什么区别？",
      answer:
        "三个套餐可使用的功能相同，区别仅在每个账期获得的积分数量。Go 每月 280 积分，Plus 每月 900 积分，Pro 每月 2,520 积分。",
    },
    {
      id: "item-3",
      question: "月付、季付和年付如何扣款？",
      answer:
        "月付每月扣款；季付享 5% 优惠，每 3 个月一次性扣款并发放 3 个月积分；年付享 10% 优惠，每年一次性扣款并发放 12 个月积分。",
    },
    {
      id: "item-4",
      question: "可以一次性购买积分吗？",
      answer:
        "可以。Starter Pack 为 14.90 美元/280 积分，Standard Pack 为 39.90 美元/900 积分，Premium Pack 为 99.90 美元/2,520 积分。无需先订阅即可购买。",
    },
    {
      id: "item-5",
      question: "订阅具体包含哪些功能？",
      answer:
        "所有付费套餐均可使用已上线的 Seedance 模型、文生视频、图生视频、模型支持的分辨率与原生音频、实时状态、历史记录和下载。seedance.co 不会额外添加平台水印。",
    },
    {
      id: "item-6",
      question: "可以随时取消订阅吗？",
      answer:
        "可以。取消后不会继续自动续费，订阅权益保留到当前账期结束；已经发放的积分仍按其原有效期使用。",
    },
  ],
  en: [
    {
      id: "item-1",
      question: "How are credits charged?",
      answer:
        "The estimated credit cost is shown before every generation. Cost depends on the selected Seedance model, duration, resolution, and number of outputs. Frozen credits are automatically returned if generation fails.",
    },
    {
      id: "item-2",
      question: "What is the difference between Go, Plus, and Pro?",
      answer:
        "All three plans include the same product capabilities. They differ only in credits per billing period: Go includes 280 credits per month, Plus 900, and Pro 2,520.",
    },
    {
      id: "item-3",
      question: "How do monthly, quarterly, and yearly billing work?",
      answer:
        "Monthly plans renew each month. Quarterly plans are billed every 3 months with 5% off and grant 3 months of credits. Yearly plans are billed once per year with 10% off and grant 12 months of credits.",
    },
    {
      id: "item-4",
      question: "Can I buy credits without a subscription?",
      answer:
        "Yes. Starter Pack is $14.90 for 280 credits, Standard Pack is $39.90 for 900 credits, and Premium Pack is $99.90 for 2,520 credits. No subscription is required.",
    },
    {
      id: "item-5",
      question: "What capabilities are included?",
      answer:
        "Every paid plan includes available Seedance models, text-to-video, image-to-video, supported resolutions and native audio, real-time status, generation history, and downloads. seedance.co does not add a platform watermark.",
    },
    {
      id: "item-6",
      question: "Can I cancel anytime?",
      answer:
        "Yes. Cancellation stops the next renewal while access continues through the current billing period. Credits already granted keep their original expiration date.",
    },
  ],
  ja: [
    {
      id: "item-1",
      question: "クレジットはどのように請求されますか？",
      answer:
        "生成前に予想クレジットが表示されます。消費量は Seedance モデル、動画時間、解像度、出力数によって決まり、生成に失敗した場合は凍結クレジットが自動返還されます。",
    },
    {
      id: "item-2",
      question: "Go、Plus、Pro の違いは何ですか？",
      answer:
        "利用できる機能は同じで、請求期間ごとのクレジット数のみ異なります。月あたり Go は 280、Plus は 900、Pro は 2,520 クレジットです。",
    },
    {
      id: "item-3",
      question: "月払い・四半期払い・年払いの仕組みは？",
      answer:
        "月払いは毎月更新、四半期払いは 5% 割引で 3 か月ごとに請求、年払いは 10% 割引で年 1 回請求され、それぞれ期間分のクレジットが付与されます。",
    },
    {
      id: "item-4",
      question: "サブスクリプションなしでクレジットを購入できますか？",
      answer:
        "はい。Starter は $14.90/280、Standard は $39.90/900、Premium は $99.90/2,520 クレジットです。",
    },
    {
      id: "item-5",
      question: "どの機能が含まれますか？",
      answer:
        "公開中の Seedance モデル、テキスト・画像からの動画生成、対応解像度と音声、進行状況、履歴、ダウンロードを利用できます。seedance.co の透かしは追加されません。",
    },
    {
      id: "item-6",
      question: "いつでも解約できますか？",
      answer:
        "はい。解約後は次回更新が停止し、現在の請求期間終了までは利用できます。付与済みクレジットの有効期限は変わりません。",
    },
  ],
  ko: [
    {
      id: "item-1",
      question: "크레딧은 어떻게 차감되나요?",
      answer:
        "생성 전에 예상 크레딧이 표시됩니다. 사용량은 Seedance 모델, 길이, 해상도, 출력 수에 따라 달라지며 생성 실패 시 동결된 크레딧이 자동 반환됩니다.",
    },
    {
      id: "item-2",
      question: "Go, Plus, Pro의 차이는 무엇인가요?",
      answer:
        "사용 가능한 기능은 동일하며 결제 기간당 크레딧만 다릅니다. 월 기준 Go 280, Plus 900, Pro 2,520 크레딧입니다.",
    },
    {
      id: "item-3",
      question: "월간, 분기, 연간 결제는 어떻게 작동하나요?",
      answer:
        "월간은 매월 갱신됩니다. 분기 결제는 5% 할인으로 3개월마다 청구되고, 연간 결제는 10% 할인으로 매년 한 번 청구되며 각 기간의 크레딧이 지급됩니다.",
    },
    {
      id: "item-4",
      question: "구독 없이 크레딧을 구매할 수 있나요?",
      answer:
        "네. Starter는 $14.90/280, Standard는 $39.90/900, Premium은 $99.90/2,520 크레딧입니다.",
    },
    {
      id: "item-5",
      question: "어떤 기능이 포함되나요?",
      answer:
        "사용 가능한 Seedance 모델, 텍스트·이미지 영상 생성, 지원 해상도와 오디오, 실시간 상태, 생성 기록과 다운로드가 포함됩니다. seedance.co 워터마크는 추가되지 않습니다.",
    },
    {
      id: "item-6",
      question: "언제든지 구독을 취소할 수 있나요?",
      answer:
        "네. 취소하면 다음 갱신이 중지되고 현재 결제 기간까지 이용할 수 있습니다. 이미 지급된 크레딧의 만료일은 유지됩니다.",
    },
  ],
};
