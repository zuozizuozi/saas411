"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const copy = {
  en: {
    title: "Video generation is temporarily paused",
    description: "We detected unusually rapid credit usage and temporarily paused new video generation to protect your account. Your existing videos remain available. Please contact us for a review.",
    close: "Close",
    contact: "Contact support",
  },
  zh: {
    title: "视频生成已暂时暂停",
    description: "系统检测到积分消耗速度异常，为保护账户已暂时停止新的生成任务。现有视频仍可正常查看和下载，请联系我们进行人工审核。",
    close: "关闭",
    contact: "联系我们",
  },
  ja: {
    title: "動画生成は一時停止されています",
    description: "クレジットの急速な消費を検出したため、アカウント保護のため新規生成を一時停止しました。既存の動画は引き続き利用できます。サポートへお問い合わせください。",
    close: "閉じる",
    contact: "サポートに連絡",
  },
  ko: {
    title: "동영상 생성이 일시 중지되었습니다",
    description: "비정상적으로 빠른 크레딧 사용이 감지되어 계정 보호를 위해 새 동영상 생성을 일시 중지했습니다. 기존 동영상은 계속 이용할 수 있습니다. 지원팀에 문의해 주세요.",
    close: "닫기",
    contact: "지원팀 문의",
  },
  fr: {
    title: "La génération vidéo est temporairement suspendue",
    description: "Une consommation inhabituellement rapide de crédits a été détectée. La création de nouvelles vidéos est temporairement suspendue pour protéger votre compte. Contactez notre assistance pour un examen.",
    close: "Fermer",
    contact: "Contacter l’assistance",
  },
  de: {
    title: "Die Videogenerierung wurde vorübergehend pausiert",
    description: "Wir haben eine ungewöhnlich schnelle Guthabennutzung erkannt und neue Generierungen zum Schutz Ihres Kontos vorübergehend pausiert. Bitte kontaktieren Sie den Support.",
    close: "Schließen",
    contact: "Support kontaktieren",
  },
  es: {
    title: "La generación de vídeo está temporalmente pausada",
    description: "Detectamos un consumo de créditos inusualmente rápido y pausamos temporalmente las nuevas generaciones para proteger tu cuenta. Contacta con soporte para revisarlo.",
    close: "Cerrar",
    contact: "Contactar con soporte",
  },
} as const;

interface GenerationPausedDialogProps {
  open: boolean;
  locale: string;
  supportEmail: string;
  onClose: () => void;
}

export function GenerationPausedDialog({ open, locale, supportEmail, onClose }: GenerationPausedDialogProps) {
  const content = copy[locale as keyof typeof copy] ?? copy.en;
  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{content.title}</AlertDialogTitle>
          <AlertDialogDescription>{content.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">{supportEmail}</div>
        <AlertDialogFooter>
          <AlertDialogCancel>{content.close}</AlertDialogCancel>
          <AlertDialogAction asChild>
            <a href={`mailto:${supportEmail}`}>{content.contact}</a>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
