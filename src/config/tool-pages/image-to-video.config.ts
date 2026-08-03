import { ToolPageConfig } from "./types";

/**
 * Image to Video 工具页面配置
 */
export const imageToVideoConfig: ToolPageConfig = {
  // SEO 配置
  seo: {
    title: "Image to Video - Transform Photos into AI Videos",
    description: "Convert your images into stunning videos using AI. Upload any photo and watch it come to life with smooth, realistic motion powered by Seedance AI models.",
    keywords: [
      "image to video",
      "photo animation",
      "ai video generator",
      "picture to video",
      "image animation",
      "seedance",
      "seedance 1.5",
    ],
    ogImage: "/og-image-to-video.jpg",
  },

  // 生成器配置
  generator: {
    mode: "image-to-video",
    uiMode: "compact",

    defaults: {
      model: "seedance-2.0-mini",
      duration: 5,
      aspectRatio: "16:9",
      outputNumber: 1,
    },

    models: {
      available: ["seedance-2.0-mini", "seedance-2.0", "seedance-1.5-pro", "seedance-2.5"],
      default: "seedance-2.0-mini",
    },

    features: {
      showImageUpload: true,
      showPromptInput: true,
      showModeSelector: false,
    },

    promptPlaceholder: "Describe the video you want to create from this image...",

    settings: {
      showDuration: true,
      showAspectRatio: true,
      showQuality: true,
      showOutputNumber: false,
      showAudioGeneration: false,

      durations: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      aspectRatios: ["16:9", "9:16", "1:1", "21:9"],
      qualities: ["speed", "quality"],
    },
  },

  // Landing Page 配置
  landing: {
    hero: {
      title: "Transform Your Images into Stunning Videos",
      description: "Upload any photo and watch AI bring it to life with smooth, realistic motion. Perfect for social media, marketing, and creative projects.",
      ctaText: "Create an Account",
      ctaSubtext: "Purchase credits or subscribe before generating",
    },

    examples: [
      {
        thumbnail: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80",
        title: "Photo to Living Scene",
        prompt: "A girl walking on the beach, hair flowing in the wind, golden sunset",
      },
      {
        thumbnail: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&q=80",
        title: "Product Animation",
        prompt: "Smartphone rotating on white background with floating particles",
      },
      {
        thumbnail: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&q=80",
        title: "Abstract Art Animation",
        prompt: "Swirling colors and shapes morphing smoothly, psychedelic style",
      },
    ],

    features: [
      "Upload any photo (JPG, PNG, WEBP up to 10MB)",
      "Multiple AI models for different animation styles",
      "Full HD output up to 1080p resolution",
      "Real-time generation status and history",
      "Credits automatically returned when generation fails",
    ],

    supportedModels: [
      { name: "Seedance 2.0 Mini", provider: "ByteDance", color: "#2563eb" },
      { name: "Seedance 2.0", provider: "ByteDance", color: "#7c3aed" },
      { name: "Seedance 1.5 Pro", provider: "ByteDance", color: "#10b981" },
      { name: "Seedance 2.5 (Coming Soon)", provider: "ByteDance", color: "#64748b" },
    ],

    stats: {
      videosGenerated: "500K+",
      usersCount: "50K+",
      avgRating: 4.8,
    },
  },

  // 多语言 key 前缀
  i18nPrefix: "ToolPage.ImageToVideo",
};
