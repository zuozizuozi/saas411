# Content safety operations

## Stage 1 controls

- High-confidence English and Chinese sexual-content patterns are blocked before credits are frozen or an AI task is created.
- Prompts are normalized to reduce simple Unicode and leetspeak bypasses. Common safe negations such as `no nudity` are removed before classification to reduce false positives.
- Seedance 2.0 requests keep EvoLink's native `content_filter` enabled.
- KIE Seedance 1.5 Pro requests always send the documented `nsfw_checker: true`, including fallback traffic.
- Optional WaveSpeed text and image moderation can run in observation or fail-closed enforcement mode.
- Generated thumbnails are rechecked by WaveSpeed when they are available and external moderation is enabled. Stage 2 should add full video-frame sampling.
- Every decision is written to `content_moderation_events`. Prompts and asset URLs are stored only as SHA-256 hashes; raw user content is not copied into the audit table.
- Admins can review events at `/admin/content-safety`.

## Rollout modes

`CONTENT_SAFETY_MODE=provider` is the safe compatibility default. It blocks the local high-confidence policy and relies on provider-native safety for images and generated video.

`CONTENT_SAFETY_MODE=observe` calls WaveSpeed for text, input images, and available output thumbnails, but only audits external flags and errors. Use this first to confirm the vendor response format and false-positive rate.

`CONTENT_SAFETY_MODE=enforce` blocks external flags and fails closed when WaveSpeed is unavailable or returns an ambiguous result. Do not enable it until the production key and clean test results are confirmed.

`CONTENT_SAFETY_REQUIRE_OUTPUT_SCAN=true` also fails closed when an output thumbnail is missing. Leave it false in Stage 1 because not every video provider returns a thumbnail.

## Activation checklist

1. Create a WaveSpeed API key with the smallest available scope and a spend alert.
2. Add `WAVESPEED_API_KEY` to Vercel Production and Preview. Never expose it with a `NEXT_PUBLIC_` prefix.
3. Set `CONTENT_SAFETY_MODE=observe` and redeploy.
4. Run safe, explicit-sexual, obfuscated, Chinese, and image test cases in a non-production account.
5. Review `/admin/content-safety`; verify WaveSpeed events have unambiguous `ALLOW` or `OBSERVE` results and no sensitive prompt text.
6. Set `CONTENT_SAFETY_MODE=enforce` and redeploy.
7. Keep `CONTENT_SAFETY_REQUIRE_OUTPUT_SCAN=false` until full video moderation or reliable thumbnail coverage is verified.

## Incident handling

- A blocked input returns `CONTENT_MODERATION_BLOCKED` before any credits are frozen.
- A transient enforced-moderation outage returns `CONTENT_MODERATION_UNAVAILABLE` and creates no AI task.
- A blocked generated thumbnail marks the video failed and releases frozen credits; the provider URL is not published.
- An unavailable output moderator leaves the task retryable with credits frozen, so the result cannot bypass moderation during an outage.
- Investigate repeated blocks or errors by user, stage, provider, and timestamp. Use hashes only for correlation; do not reconstruct or copy prohibited prompts into tickets.

## Stage 2

- Sample multiple frames from every generated video and run a video-capable classifier.
- Moderate uploads immediately after completion and cache the verdict on the media asset.
- Add an appeal/manual-review workflow, user policy strikes, rate limits, and automatic account suspension thresholds.
- Add vendor failover and per-category thresholds after observation data is available.
