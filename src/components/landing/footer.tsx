"use client";

import Image from "next/image";
import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";

import { LocaleLink } from "@/i18n/navigation";

export function LandingFooter() {
  const t = useTranslations("Footer");
  const currentYear = new Date().getFullYear();

  const footerSections = [
    {
      title: t("product"),
      links: [
        { title: "Image to Video", href: "/image-to-video" },
        { title: "Text to Video", href: "/text-to-video" },
        { title: "Reference to Video", href: "/reference-to-video" },
        { title: "Pricing", href: "/pricing" },
      ],
    },
    {
      title: t("legal"),
      links: [
        { title: t("privacy"), href: "/privacy" },
        { title: t("terms"), href: "/terms" },
      ],
    },
  ];

  return (
    <footer className="relative border-t border-white/10 bg-transparent">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-10">
          <div className="col-span-2 md:col-span-1">
            <LocaleLink
              href="/"
              className="mb-4 flex items-center gap-3 text-xl font-semibold text-white"
            >
              <Image src="/logo.svg" alt="VideoFly" width={30} height={30} className="rounded-md" />
              VideoFly
            </LocaleLink>
            <p className="max-w-xs text-sm leading-6 text-muted-foreground">
              Transform your ideas into stunning videos with AI.
            </p>
          </div>

          {footerSections.map((section) => (
            <div key={section.title}>
              <h3 className="mb-4 text-sm font-semibold text-white">
                {section.title}
              </h3>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.title}>
                    <LocaleLink
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-white"
                    >
                      {link.title}
                    </LocaleLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            {t("copyright", { year: currentYear })}
          </p>
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            Made with
            <Heart className="h-4 w-4 fill-pink-500 text-pink-500" />
            by VideoFly Team
          </p>
        </div>
      </div>
    </footer>
  );
}
