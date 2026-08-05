type SupplementalMessages = Record<string, unknown>;

export const supplementalMessages: Record<string, SupplementalMessages> = {
  en: {
    AccountProfile: { title: "Your Name", description: "Enter your full name or the display name you want others to see.", name: "Name", updateSuccess: "Your name has been updated.", updateError: "Your name was not updated. Please try again." },
    PricingCards: { off_percent: "20% OFF" },
    Metadata: { description: "Create professional AI videos with Seedance 2.0 Mini, Seedance 2.0, and Seedance 1.5 Pro." },
    Hero: { badge: "Seedance AI Video Generation" },
    FAQ: { general: { answer: "seedance.co turns text and images into high-quality AI videos with production-ready Seedance models." }, aiModels: { answer: "We currently support Seedance 2.0 Mini, Seedance 2.0, and Seedance 1.5 Pro, with additional models added after validation." } },
    CTA: { benefits: { noCard: "Secure and flexible payment options" } },
    Mail: { welcome: { featuresList: { models: "Create with Seedance 2.0 Mini, Seedance 2.0, and Seedance 1.5 Pro" } } },
    Emails: { welcome: { featuresList: { models: "Create with Seedance 2.0 Mini, Seedance 2.0, and Seedance 1.5 Pro" } } },
    dashboard: { credits: { types: { new_user: "System credit" } } }
  },
  zh: {
    AccountProfile: { title: "你的姓名", description: "请输入你的姓名或希望他人看到的显示名称。", name: "姓名", updateSuccess: "姓名已更新。", updateError: "姓名更新失败，请重试。" },
    PricingCards: { off_percent: "优惠 20%" },
    Metadata: { description: "使用 Seedance 2.0 Mini、Seedance 2.0 和 Seedance 1.5 Pro 创作专业 AI 视频。" },
    Hero: { badge: "Seedance AI 视频生成" },
    FAQ: { general: { answer: "seedance.co 使用可投入生产的 Seedance 模型，将文本和图片转化为高质量 AI 视频。" }, aiModels: { answer: "目前支持 Seedance 2.0 Mini、Seedance 2.0 和 Seedance 1.5 Pro；其他模型会在验证后陆续接入。" } },
    CTA: { benefits: { noCard: "安全灵活的付款方式" } },
    Mail: { welcome: { featuresList: { models: "使用 Seedance 2.0 Mini、Seedance 2.0 和 Seedance 1.5 Pro 创作" } } },
    Emails: { welcome: { featuresList: { models: "使用 Seedance 2.0 Mini、Seedance 2.0 和 Seedance 1.5 Pro 创作" } } },
    dashboard: { credits: { types: { new_user: "系统积分" } } }
  },
  fr: {
    AccountProfile: { title: "Votre nom", description: "Saisissez votre nom complet ou le nom d’affichage que vous souhaitez utiliser.", name: "Nom", updateSuccess: "Votre nom a été mis à jour.", updateError: "Votre nom n’a pas été mis à jour. Veuillez réessayer." },
    Metadata: { description: "Créez des vidéos IA professionnelles avec Seedance 2.0 Mini, Seedance 2.0 et Seedance 1.5 Pro." },
    Hero: { badge: "Génération vidéo IA Seedance" },
    FAQ: { general: { answer: "seedance.co transforme textes et images en vidéos IA de haute qualité grâce aux modèles Seedance prêts pour la production." }, aiModels: { answer: "Nous prenons actuellement en charge Seedance 2.0 Mini, Seedance 2.0 et Seedance 1.5 Pro. D’autres modèles seront ajoutés après validation." } },
    CTA: { benefits: { noCard: "Options de paiement sûres et flexibles" } },
    Mail: { welcome: { featuresList: { models: "Créez avec Seedance 2.0 Mini, Seedance 2.0 et Seedance 1.5 Pro" } } },
    Emails: { welcome: { featuresList: { models: "Créez avec Seedance 2.0 Mini, Seedance 2.0 et Seedance 1.5 Pro" } } },
    dashboard: { credits: { types: { new_user: "Crédit système" } } },
    ToolPage: { lowCreditTitle: "Votre solde de crédits est faible", lowCreditDescription: "Il vous restera environ {credits} crédits après cette génération.", buyCredits: "Acheter des crédits", choosePlan: "Choisir une offre" },
    PricingCards: { off_percent: "-20 %", onetime_description: "Achetez des crédits en une seule fois, sans abonnement.", one_time_payment: "Paiement unique", quarterly: "Trimestriel", quarterly_off: "-5 %", yearly_off: "-10 %", per_quarter: "/trimestre", quarterly_bill: "Trimestriel", quarterly_info: "tous les 3 mois", billed_quarterly: "Facturé {price} tous les 3 mois", billed_yearly: "Facturé {price} par an", credits: "Crédits", popular: "Populaire", processing: "Traitement...", subscribers_only: "Réservé aux abonnés", subscriber_pack_only: "Ce pack est réservé aux abonnés actifs.", checkout_not_configured: "Le paiement n’est pas configuré pour cette offre.", checkout_error: "Erreur de paiement", checkout_failed: "Impossible de créer la session de paiement." },
    VideoHistory: { promptCopied: "Prompt copié dans le presse-papiers", copyPrompt: "Copier le prompt", moreCreations: "Plus de créations" },
    GeneratorPanel: { noModels: "Aucun modèle vidéo n’est activé pour cet outil.", videoModels: "Modèles vidéo" },
    Legal: {
      Privacy: { title: "Politique de confidentialité", lastUpdated: "Dernière mise à jour : {year}", introductionTitle: "1. Introduction", introductionBody: "Bienvenue sur seedance.co. Nous respectons votre vie privée et nous engageons à protéger vos données personnelles.", collectionTitle: "2. Données collectées", collectionBody: "Nous collectons les informations que vous fournissez lorsque vous créez un compte, générez des vidéos, effectuez un paiement ou contactez l’assistance.", usageTitle: "3. Utilisation de vos données", usageBody: "Nous utilisons vos données pour fournir et améliorer le service, traiter les transactions, générer des vidéos par IA, prévenir les abus et conserver l’historique de votre compte et de vos transactions.", securityTitle: "4. Sécurité des données", securityBody: "Nous appliquons des mesures techniques et organisationnelles appropriées pour protéger vos informations personnelles, même si aucun service en ligne ne peut garantir une sécurité absolue.", contactTitle: "5. Nous contacter", contactBody: "Pour toute question relative à la confidentialité, écrivez-nous à <email>{address}</email>." },
      Terms: { title: "Conditions d’utilisation", lastUpdated: "Dernière mise à jour : {year}", acceptanceTitle: "1. Acceptation des conditions", acceptanceBody: "En accédant à seedance.co ou en l’utilisant, vous acceptez les présentes conditions. Si vous ne les acceptez pas, n’utilisez pas le service.", licenseTitle: "2. Utilisation du service", licenseBody: "Vous ne pouvez utiliser le service que dans le respect de la loi applicable et des droits d’autrui. Vous restez responsable de vos prompts, fichiers importés et contenus générés.", disclaimerTitle: "3. Exclusion de garanties", disclaimerBody: "Le service est fourni « en l’état » et « selon disponibilité ». Les résultats générés par l’IA peuvent être inexacts, indisponibles ou différents de vos attentes.", limitationsTitle: "4. Limitation de responsabilité", limitationsBody: "Dans toute la mesure permise par la loi, seedance.co et ses fournisseurs ne sont pas responsables des dommages indirects, accessoires, spéciaux, consécutifs ou punitifs liés à l’utilisation du service.", contactTitle: "5. Nous contacter", contactBody: "Pour toute question sur ces conditions, écrivez-nous à <email>{address}</email>." }
    }
  },
  de: {
    AccountProfile: { title: "Ihr Name", description: "Geben Sie Ihren vollständigen Namen oder den gewünschten Anzeigenamen ein.", name: "Name", updateSuccess: "Ihr Name wurde aktualisiert.", updateError: "Ihr Name konnte nicht aktualisiert werden. Bitte versuchen Sie es erneut." },
    Metadata: { description: "Erstellen Sie professionelle KI-Videos mit Seedance 2.0 Mini, Seedance 2.0 und Seedance 1.5 Pro." },
    Hero: { badge: "Seedance KI-Videogenerierung" },
    FAQ: { general: { answer: "seedance.co verwandelt Texte und Bilder mit produktionsreifen Seedance-Modellen in hochwertige KI-Videos." }, aiModels: { answer: "Derzeit unterstützen wir Seedance 2.0 Mini, Seedance 2.0 und Seedance 1.5 Pro. Weitere Modelle folgen nach erfolgreicher Prüfung." } },
    CTA: { benefits: { noCard: "Sichere und flexible Zahlungsoptionen" } },
    Mail: { welcome: { featuresList: { models: "Erstellen Sie Inhalte mit Seedance 2.0 Mini, Seedance 2.0 und Seedance 1.5 Pro" } } },
    Emails: { welcome: { featuresList: { models: "Erstellen Sie Inhalte mit Seedance 2.0 Mini, Seedance 2.0 und Seedance 1.5 Pro" } } },
    dashboard: { credits: { types: { new_user: "Systemguthaben" } } },
    ToolPage: { lowCreditTitle: "Ihr Credit-Guthaben wird knapp", lowCreditDescription: "Nach dieser Generierung verbleiben voraussichtlich etwa {credits} Credits.", buyCredits: "Credits kaufen", choosePlan: "Tarif auswählen" },
    PricingCards: { off_percent: "20 % sparen", onetime_description: "Credits einmalig und ohne Abonnement kaufen.", one_time_payment: "Einmalige Zahlung", quarterly: "Vierteljährlich", quarterly_off: "5 % sparen", yearly_off: "10 % sparen", per_quarter: "/Quartal", quarterly_bill: "Vierteljährlich", quarterly_info: "alle 3 Monate", billed_quarterly: "Alle 3 Monate {price}", billed_yearly: "Jährlich {price}", credits: "Credits", popular: "Beliebt", processing: "Wird verarbeitet...", subscribers_only: "Nur für Abonnenten", subscriber_pack_only: "Dieses Paket ist nur für aktive Abonnenten verfügbar.", checkout_not_configured: "Der Checkout ist für diesen Tarif noch nicht eingerichtet.", checkout_error: "Checkout-Fehler", checkout_failed: "Die Checkout-Sitzung konnte nicht erstellt werden." },
    VideoHistory: { promptCopied: "Prompt in die Zwischenablage kopiert", copyPrompt: "Prompt kopieren", moreCreations: "Weitere Kreationen" },
    GeneratorPanel: { noModels: "Für dieses Werkzeug ist kein Videomodell aktiviert.", videoModels: "Videomodelle" },
    Legal: {
      Privacy: { title: "Datenschutzerklärung", lastUpdated: "Zuletzt aktualisiert: {year}", introductionTitle: "1. Einleitung", introductionBody: "Willkommen bei seedance.co. Wir respektieren Ihre Privatsphäre und schützen Ihre personenbezogenen Daten.", collectionTitle: "2. Erhobene Daten", collectionBody: "Wir erfassen Informationen, die Sie bei der Kontoerstellung, Videogenerierung, Zahlung oder Kontaktaufnahme mit dem Support angeben.", usageTitle: "3. Verwendung Ihrer Daten", usageBody: "Wir verwenden Ihre Daten, um den Dienst bereitzustellen und zu verbessern, Zahlungen abzuwickeln, KI-Videos zu generieren, Missbrauch zu verhindern sowie Konto- und Transaktionsverläufe zu führen.", securityTitle: "4. Datensicherheit", securityBody: "Wir setzen angemessene technische und organisatorische Schutzmaßnahmen ein. Kein Internetdienst kann jedoch absolute Sicherheit garantieren.", contactTitle: "5. Kontakt", contactBody: "Bei Fragen zum Datenschutz schreiben Sie uns an <email>{address}</email>." },
      Terms: { title: "Nutzungsbedingungen", lastUpdated: "Zuletzt aktualisiert: {year}", acceptanceTitle: "1. Annahme der Bedingungen", acceptanceBody: "Mit dem Zugriff auf seedance.co oder dessen Nutzung stimmen Sie diesen Nutzungsbedingungen zu. Wenn Sie nicht zustimmen, nutzen Sie den Dienst nicht.", licenseTitle: "2. Nutzung des Dienstes", licenseBody: "Sie dürfen den Dienst nur im Einklang mit geltendem Recht und den Rechten Dritter nutzen. Für Ihre Prompts, Uploads und generierten Inhalte bleiben Sie verantwortlich.", disclaimerTitle: "3. Haftungsausschluss", disclaimerBody: "Der Dienst wird „wie besehen“ und „wie verfügbar“ bereitgestellt. KI-generierte Ergebnisse können ungenau, nicht verfügbar oder anders als erwartet sein.", limitationsTitle: "4. Haftungsbeschränkung", limitationsBody: "Soweit gesetzlich zulässig, haften seedance.co und seine Anbieter nicht für indirekte, beiläufige, besondere, Folge- oder Strafschäden aus der Nutzung des Dienstes.", contactTitle: "5. Kontakt", contactBody: "Bei Fragen zu diesen Bedingungen schreiben Sie uns an <email>{address}</email>." }
    }
  },
  es: {
    AccountProfile: { title: "Tu nombre", description: "Introduce tu nombre completo o el nombre que quieres mostrar.", name: "Nombre", updateSuccess: "Tu nombre se ha actualizado.", updateError: "No se pudo actualizar tu nombre. Inténtalo de nuevo." },
    Metadata: { description: "Crea vídeos profesionales con IA usando Seedance 2.0 Mini, Seedance 2.0 y Seedance 1.5 Pro." },
    Hero: { badge: "Generación de vídeo con IA Seedance" },
    FAQ: { general: { answer: "seedance.co convierte texto e imágenes en vídeos de alta calidad con modelos Seedance listos para producción." }, aiModels: { answer: "Actualmente admitimos Seedance 2.0 Mini, Seedance 2.0 y Seedance 1.5 Pro. Añadiremos más modelos después de validarlos." } },
    CTA: { benefits: { noCard: "Opciones de pago seguras y flexibles" } },
    Mail: { welcome: { featuresList: { models: "Crea con Seedance 2.0 Mini, Seedance 2.0 y Seedance 1.5 Pro" } } },
    Emails: { welcome: { featuresList: { models: "Crea con Seedance 2.0 Mini, Seedance 2.0 y Seedance 1.5 Pro" } } },
    dashboard: { credits: { types: { new_user: "Crédito del sistema" } } },
    ToolPage: { lowCreditTitle: "Tu saldo de créditos se está agotando", lowCreditDescription: "Después de esta generación te quedarán aproximadamente {credits} créditos.", buyCredits: "Comprar créditos", choosePlan: "Elegir un plan" },
    PricingCards: { off_percent: "20 % DTO.", onetime_description: "Compra créditos una sola vez, sin suscripción.", one_time_payment: "Pago único", quarterly: "Trimestral", quarterly_off: "5 % DTO.", yearly_off: "10 % DTO.", per_quarter: "/trimestre", quarterly_bill: "Trimestral", quarterly_info: "cada 3 meses", billed_quarterly: "Facturación de {price} cada 3 meses", billed_yearly: "Facturación anual de {price}", credits: "Créditos", popular: "Popular", processing: "Procesando...", subscribers_only: "Solo para suscriptores", subscriber_pack_only: "Este paquete solo está disponible para suscriptores activos.", checkout_not_configured: "El pago no está configurado para este plan.", checkout_error: "Error de pago", checkout_failed: "No se pudo crear la sesión de pago." },
    VideoHistory: { promptCopied: "Prompt copiado al portapapeles", copyPrompt: "Copiar prompt", moreCreations: "Más creaciones" },
    GeneratorPanel: { noModels: "No hay ningún modelo de vídeo activado para esta herramienta.", videoModels: "Modelos de vídeo" },
    Legal: {
      Privacy: { title: "Política de privacidad", lastUpdated: "Última actualización: {year}", introductionTitle: "1. Introducción", introductionBody: "Bienvenido a seedance.co. Respetamos tu privacidad y nos comprometemos a proteger tus datos personales.", collectionTitle: "2. Datos que recopilamos", collectionBody: "Recopilamos la información que proporcionas al crear una cuenta, generar vídeos, realizar un pago o contactar con soporte.", usageTitle: "3. Cómo usamos tus datos", usageBody: "Usamos tus datos para prestar y mejorar el servicio, procesar transacciones, generar vídeos con IA, prevenir abusos y mantener el historial de tu cuenta y transacciones.", securityTitle: "4. Seguridad de los datos", securityBody: "Aplicamos medidas técnicas y organizativas adecuadas para proteger tu información personal, aunque ningún servicio de internet puede garantizar una seguridad absoluta.", contactTitle: "5. Contacto", contactBody: "Para consultas sobre privacidad, escríbenos a <email>{address}</email>." },
      Terms: { title: "Términos de servicio", lastUpdated: "Última actualización: {year}", acceptanceTitle: "1. Aceptación de los términos", acceptanceBody: "Al acceder o utilizar seedance.co, aceptas estos Términos de servicio. Si no estás de acuerdo, no utilices el servicio.", licenseTitle: "2. Uso del servicio", licenseBody: "Solo puedes usar el servicio conforme a la legislación aplicable y respetando los derechos de terceros. Eres responsable de tus prompts, archivos subidos y contenido generado.", disclaimerTitle: "3. Descargo de responsabilidad", disclaimerBody: "El servicio se ofrece «tal cual» y «según disponibilidad». Los resultados generados por IA pueden ser inexactos, no estar disponibles o diferir de tus expectativas.", limitationsTitle: "4. Limitación de responsabilidad", limitationsBody: "En la máxima medida permitida por la ley, seedance.co y sus proveedores no responden por daños indirectos, incidentales, especiales, consecuentes o punitivos derivados del uso del servicio.", contactTitle: "5. Contacto", contactBody: "Para consultas sobre estos términos, escríbenos a <email>{address}</email>." }
    }
  },
  ja: {
    AccountProfile: { title: "お名前", description: "氏名または表示したい名前を入力してください。", name: "名前", updateSuccess: "名前を更新しました。", updateError: "名前を更新できませんでした。もう一度お試しください。" },
    Metadata: { description: "Seedance 2.0 Mini、Seedance 2.0、Seedance 1.5 Proでプロ品質のAI動画を作成できます。" },
    Hero: { badge: "Seedance AI動画生成" },
    FAQ: { general: { answer: "seedance.coは、実運用向けSeedanceモデルでテキストや画像を高品質なAI動画に変換します。" }, aiModels: { answer: "現在はSeedance 2.0 Mini、Seedance 2.0、Seedance 1.5 Proに対応しています。追加モデルは検証後に順次導入します。" } },
    CTA: { benefits: { noCard: "安全で柔軟な支払い方法" } },
    Mail: { welcome: { featuresList: { models: "Seedance 2.0 Mini、Seedance 2.0、Seedance 1.5 Proで作成" } } },
    Emails: { welcome: { featuresList: { models: "Seedance 2.0 Mini、Seedance 2.0、Seedance 1.5 Proで作成" } } },
    dashboard: { credits: { types: { new_user: "システムクレジット" } } },
    ToolPage: { lowCreditTitle: "クレジット残高が少なくなっています", lowCreditDescription: "この生成後の残高は約{credits}クレジットです。", buyCredits: "クレジットを購入", choosePlan: "プランを選択" },
    PricingCards: { off_percent: "20% OFF", onetime_description: "サブスクリプションなしでクレジットを一度だけ購入できます。", one_time_payment: "一括払い", quarterly: "3か月払い", quarterly_off: "5% OFF", yearly_off: "10% OFF", per_quarter: "/3か月", quarterly_bill: "3か月払い", quarterly_info: "3か月ごと", billed_quarterly: "3か月ごとに{price}を請求", billed_yearly: "年間{price}を請求", credits: "クレジット", popular: "人気", processing: "処理中...", subscribers_only: "購読者限定", subscriber_pack_only: "このパックは有効な購読者のみ利用できます。", checkout_not_configured: "このプランの決済はまだ設定されていません。", checkout_error: "決済エラー", checkout_failed: "決済セッションを作成できませんでした。" },
    VideoHistory: { promptCopied: "プロンプトをクリップボードにコピーしました", copyPrompt: "プロンプトをコピー", moreCreations: "その他の作品" },
    GeneratorPanel: { noModels: "このツールで有効な動画モデルがありません。", videoModels: "動画モデル" },
    Legal: {
      Privacy: { title: "プライバシーポリシー", lastUpdated: "最終更新：{year}年", introductionTitle: "1. はじめに", introductionBody: "seedance.coへようこそ。当社はお客様のプライバシーを尊重し、個人データの保護に努めます。", collectionTitle: "2. 収集するデータ", collectionBody: "アカウント作成、動画生成、支払い、またはサポートへのお問い合わせ時に提供された情報を収集します。", usageTitle: "3. データの利用目的", usageBody: "サービスの提供と改善、取引処理、AI動画生成、不正利用防止、アカウントおよび取引履歴の管理にデータを使用します。", securityTitle: "4. データセキュリティ", securityBody: "個人情報を保護するため適切な技術的・組織的対策を講じますが、インターネットサービスの絶対的な安全性は保証できません。", contactTitle: "5. お問い合わせ", contactBody: "プライバシーに関するご質問は <email>{address}</email> までご連絡ください。" },
      Terms: { title: "利用規約", lastUpdated: "最終更新：{year}年", acceptanceTitle: "1. 規約への同意", acceptanceBody: "seedance.coにアクセスまたは利用することで、本利用規約に同意したものとみなされます。同意しない場合はサービスを利用しないでください。", licenseTitle: "2. サービスの利用", licenseBody: "適用法および第三者の権利を守ってサービスを利用してください。プロンプト、アップロード、生成コンテンツについてはお客様が責任を負います。", disclaimerTitle: "3. 免責事項", disclaimerBody: "サービスは「現状有姿」かつ「提供可能な範囲」で提供されます。AI生成結果は不正確、利用不能、または期待と異なる場合があります。", limitationsTitle: "4. 責任の制限", limitationsBody: "法令で認められる最大限の範囲で、seedance.coおよびその提供者は、サービス利用に起因する間接的、偶発的、特別、結果的または懲罰的損害について責任を負いません。", contactTitle: "5. お問い合わせ", contactBody: "本規約に関するご質問は <email>{address}</email> までご連絡ください。" }
    }
  },
  ko: {
    AccountProfile: { title: "이름", description: "실명 또는 다른 사용자에게 표시할 이름을 입력하세요.", name: "이름", updateSuccess: "이름이 업데이트되었습니다.", updateError: "이름을 업데이트하지 못했습니다. 다시 시도해 주세요." },
    Metadata: { description: "Seedance 2.0 Mini, Seedance 2.0, Seedance 1.5 Pro로 전문적인 AI 비디오를 제작하세요." },
    Hero: { badge: "Seedance AI 비디오 생성" },
    FAQ: { general: { answer: "seedance.co는 실제 서비스에 적합한 Seedance 모델로 텍스트와 이미지를 고품질 AI 비디오로 변환합니다." }, aiModels: { answer: "현재 Seedance 2.0 Mini, Seedance 2.0, Seedance 1.5 Pro를 지원하며, 추가 모델은 검증 후 순차적으로 도입합니다." } },
    CTA: { benefits: { noCard: "안전하고 유연한 결제 옵션" } },
    Mail: { welcome: { featuresList: { models: "Seedance 2.0 Mini, Seedance 2.0, Seedance 1.5 Pro로 제작" } } },
    Emails: { welcome: { featuresList: { models: "Seedance 2.0 Mini, Seedance 2.0, Seedance 1.5 Pro로 제작" } } },
    dashboard: { credits: { types: { new_user: "시스템 크레딧" } } },
    ToolPage: { lowCreditTitle: "크레딧 잔액이 부족해지고 있습니다", lowCreditDescription: "이번 생성 후 약 {credits} 크레딧이 남습니다.", buyCredits: "크레딧 구매", choosePlan: "요금제 선택" },
    PricingCards: { off_percent: "20% 할인", onetime_description: "구독 없이 크레딧을 한 번만 구매하세요.", one_time_payment: "일회성 결제", quarterly: "분기별", quarterly_off: "5% 할인", yearly_off: "10% 할인", per_quarter: "/분기", quarterly_bill: "분기별", quarterly_info: "3개월마다", billed_quarterly: "3개월마다 {price} 청구", billed_yearly: "연간 {price} 청구", credits: "크레딧", popular: "인기", processing: "처리 중...", subscribers_only: "구독자 전용", subscriber_pack_only: "이 패키지는 활성 구독자만 이용할 수 있습니다.", checkout_not_configured: "이 요금제의 결제가 아직 설정되지 않았습니다.", checkout_error: "결제 오류", checkout_failed: "결제 세션을 만들 수 없습니다." },
    VideoHistory: { promptCopied: "프롬프트를 클립보드에 복사했습니다", copyPrompt: "프롬프트 복사", moreCreations: "더 많은 작품" },
    GeneratorPanel: { noModels: "이 도구에 활성화된 비디오 모델이 없습니다.", videoModels: "비디오 모델" },
    Legal: {
      Privacy: { title: "개인정보 처리방침", lastUpdated: "최종 업데이트: {year}년", introductionTitle: "1. 소개", introductionBody: "seedance.co에 오신 것을 환영합니다. 당사는 사용자의 개인정보를 존중하고 개인 데이터를 보호하기 위해 노력합니다.", collectionTitle: "2. 수집하는 데이터", collectionBody: "계정 생성, 비디오 생성, 결제 또는 고객지원 문의 시 사용자가 제공하는 정보를 수집합니다.", usageTitle: "3. 데이터 이용 방법", usageBody: "서비스 제공과 개선, 거래 처리, AI 비디오 생성, 오용 방지, 계정 및 거래 기록 관리를 위해 데이터를 사용합니다.", securityTitle: "4. 데이터 보안", securityBody: "개인정보 보호를 위해 적절한 기술적·관리적 보호조치를 적용하지만 인터넷 서비스의 절대적인 보안을 보장할 수는 없습니다.", contactTitle: "5. 문의", contactBody: "개인정보 관련 문의는 <email>{address}</email>로 보내 주세요." },
      Terms: { title: "서비스 이용약관", lastUpdated: "최종 업데이트: {year}년", acceptanceTitle: "1. 약관 동의", acceptanceBody: "seedance.co에 접속하거나 이용하면 본 서비스 이용약관에 동의하는 것입니다. 동의하지 않으면 서비스를 이용하지 마세요.", licenseTitle: "2. 서비스 이용", licenseBody: "관련 법률과 타인의 권리를 준수하는 범위에서만 서비스를 이용할 수 있습니다. 프롬프트, 업로드 및 생성 콘텐츠에 대한 책임은 사용자에게 있습니다.", disclaimerTitle: "3. 면책 조항", disclaimerBody: "서비스는 ‘있는 그대로’ 및 ‘이용 가능한 상태’로 제공됩니다. AI 생성 결과는 부정확하거나 이용할 수 없거나 기대와 다를 수 있습니다.", limitationsTitle: "4. 책임 제한", limitationsBody: "법이 허용하는 최대 범위에서 seedance.co와 공급자는 서비스 이용으로 발생하는 간접적, 우발적, 특별, 결과적 또는 징벌적 손해에 책임을 지지 않습니다.", contactTitle: "5. 문의", contactBody: "본 약관에 관한 문의는 <email>{address}</email>로 보내 주세요." }
    }
  }
};
