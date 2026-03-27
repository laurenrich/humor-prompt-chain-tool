/**
 * Almost Crackd pipeline (api.almostcrackd.ai).
 *
 * File upload (JWT = Supabase session access token on every Almost Crackd call except PUT):
 * 1. POST /pipeline/generate-presigned-url  Body: { contentType }  → { presignedUrl, cdnUrl }
 * 2. PUT <presignedUrl> (S3, not api.almostcrackd.ai)  Body: raw bytes, Content-Type must match (1)
 * 3. POST /pipeline/upload-image-from-url  Body: { imageUrl: cdnUrl, isCommonUse: false }  → { imageId, now }
 * 4. POST /pipeline/generate-captions  Body: { imageId, humorFlavorId }
 *
 */

function apiBase(): string {
  return (process.env.ALMOSTCRACKD_API_BASE_URL ?? "https://api.almostcrackd.ai").replace(
    /\/$/,
    "",
  );
}

/** First bytes look like a real image (not HTML/XML starting with <). */
function looksLikeImageMagic(buf: Uint8Array): boolean {
  if (buf.length < 3) return false;
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  // PNG
  if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)
    return true;
  // GIF
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return true;
  // WEBP (RIFF....WEBP)
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  )
    return true;
  return false;
}

/**
 * Fail fast if the URL is a web page or error HTML instead of a raw image.
 * Almost Crackd can 500 with JSON parse errors when the URL does not return image bytes.
 * Verifies actual bytes (magic numbers), not only Content-Type — CDNs sometimes mislabel HTML.
 */
async function assertDirectImageUrl(imageUrl: string): Promise<void> {
  let res = await fetch(imageUrl, {
    method: "GET",
    redirect: "follow",
    headers: { Range: "bytes=0-4095" },
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok && res.status === 416) {
    res = await fetch(imageUrl, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(25_000),
    });
  }
  const ct = res.headers.get("content-type") ?? "";

  if (!res.ok) {
    throw new Error(
      `This image URL returned HTTP ${res.status}. Use a direct link that opens as a picture (try “Open image in new tab” on a photo, then copy that URL).`,
    );
  }

  const buf = new Uint8Array(await res.arrayBuffer());
  if (looksLikeImageMagic(buf)) return;

  const lower = ct.toLowerCase();
  const pathLooksImage = /\.(jpe?g|png|gif|webp|bmp|avif)(\?|#|$)/i.test(
    new URL(imageUrl).pathname,
  );
  const looksLikeImage =
    lower.includes("image/") ||
    (lower.includes("application/octet-stream") && pathLooksImage);

  if (looksLikeImage && buf.length > 0) return;

  const sniff = new TextDecoder("utf-8", { fatal: false }).decode(buf.slice(0, 120));
  throw new Error(
    `This URL did not return raw image bytes (got ${ct || "unknown"}; starts with: ${sniff.slice(0, 80).replace(/\s+/g, " ")}). ` +
      `Use a direct HTTPS link to image bytes — not a gallery page or error HTML.`,
  );
}

function readStringId(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && String(v).length > 0) return String(v);
  }
  return undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Pull presigned PUT URL + optional public CDN URL from generate-presigned-url JSON. */
function extractPresignPayload(json: unknown): {
  presignedUrl: string;
  /** Readable HTTPS URL for upload-image-from-url; if missing, caller may try `presignedUrl` after PUT. */
  cdnUrl?: string;
} {
  if (!json || typeof json !== "object") throw new Error("presign: empty response");
  const o = json as Record<string, unknown>;
  const data =
    o.data && typeof o.data === "object" ? (o.data as Record<string, unknown>) : o;

  const presignedExplicit =
    readStringId(data, [
      "presignedUrl",
      "presigned_url",
      "uploadUrl",
      "upload_url",
      "putUrl",
      "put_url",
      "signedUrl",
      "signed_url",
    ]) ?? readStringId(o, ["presignedUrl", "presigned_url", "uploadUrl"]);

  const cdnKeys = [
    "cdnUrl",
    "cdn_url",
    "imageUrl",
    "image_url",
    "publicUrl",
    "public_url",
    "downloadUrl",
    "download_url",
    "readUrl",
    "read_url",
    "viewUrl",
    "view_url",
    "getUrl",
    "get_url",
    "fileUrl",
    "file_url",
    "accessUrl",
    "access_url",
  ];
  let cdnUrl = readStringId(data, cdnKeys);
  if (!cdnUrl) {
    cdnUrl = readStringId(o, cdnKeys);
  }

  const genericUrl = readStringId(data, ["url"]) ?? readStringId(o, ["url"]);
  let presignedUrl = presignedExplicit;
  if (!presignedUrl && genericUrl) presignedUrl = genericUrl;

  if (!presignedUrl) {
    throw new Error(`presign: missing presigned URL: ${JSON.stringify(json).slice(0, 400)}`);
  }

  /** URL Almost Crackd can GET as raw image bytes (do not strip S3 query params — that often yields 403/HTML). */
  let publicUrl = cdnUrl;
  if (!publicUrl && genericUrl && genericUrl !== presignedUrl) {
    publicUrl = genericUrl;
  }

  return { presignedUrl, cdnUrl: publicUrl };
}

/** Pull imageId from upload-image-from-url JSON. */
function extractImageId(json: unknown): string | undefined {
  if (!json || typeof json !== "object") return undefined;
  const o = json as Record<string, unknown>;
  let id = readStringId(o, ["imageId", "image_id", "id"]);
  if (id) return id;
  const data = o.data;
  if (data && typeof data === "object") {
    id = readStringId(data as Record<string, unknown>, ["imageId", "image_id", "id"]);
  }
  return id;
}

/** Pull caption lines from generate-captions JSON. */
function extractCaptionsList(json: unknown): string[] {
  if (Array.isArray(json)) {
    const out: string[] = [];
    for (const item of json) {
      if (typeof item === "string") out.push(item);
      else if (item && typeof item === "object") {
        const r = item as Record<string, unknown>;
        const t = r.text ?? r.caption ?? r.content ?? r.body;
        if (t !== undefined) out.push(String(t));
      }
    }
    return out.length ? out : [];
  }
  if (!json || typeof json !== "object") return [];
  const o = json as Record<string, unknown>;

  const tryArray = (x: unknown): string[] | undefined => {
    if (!Array.isArray(x)) return undefined;
    const out: string[] = [];
    for (const item of x) {
      if (typeof item === "string") out.push(item);
      else if (item && typeof item === "object" && "text" in item)
        out.push(String((item as { text: unknown }).text));
      else if (item && typeof item === "object" && "caption" in item)
        out.push(String((item as { caption: unknown }).caption));
    }
    return out.length ? out : undefined;
  };

  let caps = tryArray(o.captions);
  if (caps) return caps;

  const data = o.data;
  if (data && typeof data === "object") {
    caps = tryArray((data as Record<string, unknown>).captions);
    if (caps) return caps;
  }

  if (typeof o.output_text === "string" && o.output_text.trim())
    return parseCaptionsFromText(o.output_text);
  if (typeof o.text === "string" && o.text.trim()) return parseCaptionsFromText(o.text);

  return [];
}

/** Pull per-step outputs if the API returns them; otherwise undefined. */
function extractStepOutputs(
  json: unknown,
): { step_order: number; output: string }[] | undefined {
  if (!json || typeof json !== "object") return undefined;
  const o = json as Record<string, unknown>;
  const raw = o.stepOutputs ?? o.step_outputs;
  if (!Array.isArray(raw)) return undefined;
  const out: { step_order: number; output: string }[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const step = r.step_order ?? r.stepOrder ?? r.order;
    const output = r.output ?? r.text;
    if (step !== undefined && output !== undefined) {
      out.push({ step_order: Number(step), output: String(output) });
    }
  }
  return out.length ? out : undefined;
}

export type HumorFlavorPipelineInput = {
  accessToken: string;
  imageUrl: string;
  /** humor_flavors.id — API may expect string or number */
  humorFlavorId: string;
  /** DB order_by values for each step (ascending); used for mock + fallback stepOutputs */
  stepOrders: number[];
  /**
   * When true, skip HEAD/GET check on imageUrl (use for Almost Crackd CDN URLs after presigned upload).
   */
  skipUrlAssert?: boolean;
};

export type HumorFlavorPipelineResult = {
  finalCaptions: string[];
  stepOutputs: { step_order: number; output: string }[];
};

function parseGenerateCaptionsSuccess(
  captionRaw: string,
  input: { stepOrders: number[] },
): HumorFlavorPipelineResult {
  let captionJson: unknown;
  try {
    captionJson = JSON.parse(captionRaw);
  } catch {
    throw new Error(`generate-captions: invalid JSON: ${captionRaw.slice(0, 500)}`);
  }

  const fromApi = extractStepOutputs(captionJson);
  let finalCaptions = extractCaptionsList(captionJson);
  if (!finalCaptions.length && captionRaw.length < 800) {
    finalCaptions = parseCaptionsFromText(captionRaw);
  }

  let stepOutputs: { step_order: number; output: string }[];
  if (fromApi?.length) {
    stepOutputs = fromApi;
  } else if (input.stepOrders.length) {
    const joined = finalCaptions.length ? finalCaptions.join("\n") : captionRaw.trim();
    stepOutputs = input.stepOrders.map((order, i) =>
      i === input.stepOrders.length - 1
        ? { step_order: order, output: joined || "(no caption text parsed)" }
        : {
            step_order: order,
            output:
              "(Intermediate steps run on Almost Crackd servers as part of this humor flavor.)",
          },
    );
  } else {
    stepOutputs = [{ step_order: 1, output: captionRaw.trim() || JSON.stringify(captionJson) }];
  }

  return { finalCaptions, stepOutputs };
}

async function runGenerateCaptionsPhase(input: {
  accessToken: string;
  imageId: string;
  humorFlavorId: string;
  stepOrders: number[];
}): Promise<HumorFlavorPipelineResult> {
  const base = apiBase();
  const humorFlavorId = String(input.humorFlavorId).trim();
  const imageId = String(input.imageId).trim();

  const headers = {
    Authorization: `Bearer ${input.accessToken}`,
    "Content-Type": "application/json",
  } as const;

  /**
   * Try **query + `{ imageId }` body first** — often works when combined JSON body 500s, so we avoid
   * an extra slow failure before the working shape. Assignment minimal `{ imageId }` only is last.
   */
  const variants: { label: string; url: string; body: string }[] = [
    {
      label: "imageId + humorFlavorId query",
      url: `${base}/pipeline/generate-captions?humorFlavorId=${encodeURIComponent(humorFlavorId)}`,
      body: JSON.stringify({ imageId }),
    },
    {
      label: "imageId+humorFlavorId (JSON body)",
      url: `${base}/pipeline/generate-captions`,
      body: JSON.stringify({ imageId, humorFlavorId }),
    },
    {
      label: "imageId only (assignment minimal body)",
      url: `${base}/pipeline/generate-captions`,
      body: JSON.stringify({ imageId }),
    },
  ];

  let lastStatus = 0;
  let lastRaw = "";
  const maxAttemptsPerVariant = Math.min(
    4,
    Math.max(1, Number(process.env.ALMOSTCRACKD_CAPTION_ATTEMPTS_PER_VARIANT ?? 1)),
  );

  for (const v of variants) {
    for (let attempt = 1; attempt <= maxAttemptsPerVariant; attempt++) {
      if (attempt > 1) {
        await sleep(Math.min(1200, 150 * Math.pow(2, attempt - 2)));
      }

      const captionRes = await fetch(v.url, {
        method: "POST",
        headers,
        body: v.body,
      });
      lastStatus = captionRes.status;
      lastRaw = await captionRes.text();

      if (captionRes.ok) {
        return parseGenerateCaptionsSuccess(lastRaw, input);
      }

      /** Don’t waste retries on Almost Crackd’s known bad response — try next body shape next. */
      const imageJsonBug =
        captionRes.status === 500 && /not valid JSON|The image/i.test(lastRaw);
      if (imageJsonBug) {
        break;
      }

      const retryable =
        [500, 502, 503, 504].includes(captionRes.status) &&
        attempt < maxAttemptsPerVariant;
      if (retryable) {
        continue;
      }
      break;
    }
  }

  const crackdBug =
    /not valid JSON|The image/i.test(lastRaw) && lastStatus === 500;
  const tail = crackdBug
    ? "\n\n— Almost Crackd returned this 500 (not your app). Tried: query+imageId → combined body → imageId-only."
    : "";

  throw new Error(
    `[Step 4/4 generate-captions] HTTP ${lastStatus}: ${lastRaw}${tail}`,
  );
}

/** Step 3 — returns imageId from Almost Crackd. */
async function registerImageFromUrl(
  accessToken: string,
  imageUrl: string,
): Promise<string> {
  const base = apiBase();
  const uploadRes = await fetch(`${base}/pipeline/upload-image-from-url`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      imageUrl,
      isCommonUse: false,
    }),
  });
  const uploadRaw = await uploadRes.text();
  if (!uploadRes.ok) {
    throw new Error(
      `[Step 3/4 register image (upload-image-from-url)] HTTP ${uploadRes.status}: ${uploadRaw}`,
    );
  }
  let uploadJson: unknown;
  try {
    uploadJson = JSON.parse(uploadRaw);
  } catch {
    throw new Error(
      `[Step 3/4 register image] Invalid JSON: ${uploadRaw.slice(0, 500)}`,
    );
  }
  const imageId = extractImageId(uploadJson);
  if (!imageId) {
    throw new Error(
      `[Step 3/4 register image] No imageId in response: ${uploadRaw.slice(0, 500)}`,
    );
  }
  return imageId;
}

/**
 * Register a public image URL, then run generate-captions for this humor flavor.
 * Server applies the flavor’s step chain (per assignment).
 */
export async function runHumorFlavorPipeline(
  input: HumorFlavorPipelineInput,
): Promise<HumorFlavorPipelineResult> {
  const mock = process.env.ALMOSTCRACKD_MOCK === "true";
  if (mock) {
    const stepOutputs = input.stepOrders.map((order) => ({
      step_order: order,
      output: `[mock] Pipeline step ${order} (set ALMOSTCRACKD_MOCK=false for real API)`,
    }));
    const last = stepOutputs[stepOutputs.length - 1]?.output ?? "";
    return {
      finalCaptions: parseCaptionsFromText(last),
      stepOutputs,
    };
  }

  if (!input.accessToken) {
    throw new Error(
      "No Supabase access token — sign in again or set ALMOSTCRACKD_MOCK=true for local stubs.",
    );
  }

  if (!input.skipUrlAssert) {
    await assertDirectImageUrl(input.imageUrl);
  }

  const postRegisterDelay = Math.min(
    8000,
    Math.max(0, Number(process.env.ALMOSTCRACKD_POST_REGISTER_DELAY_MS ?? 400)),
  );
  /** Re-register the same imageUrl after step 4 fails — often yields a fresh imageId that succeeds. */
  const registerPasses = Math.min(
    4,
    Math.max(1, Number(process.env.ALMOSTCRACKD_REGISTER_RETRY_PASSES ?? 1)),
  );

  let lastErr: unknown = null;

  for (let pass = 1; pass <= registerPasses; pass++) {
    if (pass > 1) {
      await sleep(1500);
    }

    const imageId = await registerImageFromUrl(input.accessToken, input.imageUrl);
    await sleep(postRegisterDelay);

    try {
      return await runGenerateCaptionsPhase({
        accessToken: input.accessToken,
        imageId,
        humorFlavorId: input.humorFlavorId,
        stepOrders: input.stepOrders,
      });
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      const step4Failed = /Step 4|generate-captions/i.test(msg);
      if (step4Failed && pass < registerPasses) {
        continue;
      }
      throw e;
    }
  }

  throw lastErr instanceof Error
    ? lastErr
    : new Error(String(lastErr));
}

export type HumorFlavorPipelineFromFileInput = {
  accessToken: string;
  humorFlavorId: string;
  stepOrders: number[];
  /** Raw image bytes (e.g. from FormData File). */
  fileBytes: Buffer;
  /** MIME type, e.g. image/jpeg — sent to presign and PUT. */
  contentType: string;
};

/** One full run: presign → PUT → register + captions (steps 1–4). */
async function presignPutThenPipeline(
  input: HumorFlavorPipelineFromFileInput,
): Promise<HumorFlavorPipelineResult> {
  const base = apiBase();
  const ct =
    input.contentType && input.contentType.startsWith("image/")
      ? input.contentType
      : "image/jpeg";

  const presignRes = await fetch(`${base}/pipeline/generate-presigned-url`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ contentType: ct }),
  });
  const presignRaw = await presignRes.text();
  if (!presignRes.ok) {
    throw new Error(
      `[Step 1/4 presign] HTTP ${presignRes.status}: ${presignRaw}`,
    );
  }
  let presignJson: unknown;
  try {
    presignJson = JSON.parse(presignRaw);
  } catch {
    throw new Error(`[Step 1/4 presign] Invalid JSON: ${presignRaw.slice(0, 500)}`);
  }
  const { presignedUrl, cdnUrl: cdnFromPresign } = extractPresignPayload(presignJson);
  if (!cdnFromPresign) {
    throw new Error(
      `[Step 1/4 presign] Missing cdnUrl (need { presignedUrl, cdnUrl }). ${JSON.stringify(presignJson).slice(0, 500)}`,
    );
  }

  const putRes = await fetch(presignedUrl, {
    method: "PUT",
    body: new Uint8Array(input.fileBytes),
    headers: { "Content-Type": ct },
  });
  if (!putRes.ok) {
    throw new Error(
      `[Step 2/4 PUT to storage] HTTP ${putRes.status}: ${await putRes.text()}`,
    );
  }

  if (process.env.ALMOSTCRACKD_SKIP_CDN_ASSERT !== "true") {
    try {
      await assertDirectImageUrl(cdnFromPresign);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(
        `[After step 2] ${msg} The cdnUrl from presign must return image bytes before step 3.`,
      );
    }
  }

  return runHumorFlavorPipeline({
    accessToken: input.accessToken,
    imageUrl: cdnFromPresign,
    humorFlavorId: input.humorFlavorId,
    stepOrders: input.stepOrders,
    skipUrlAssert: true,
  });
}

/**
 * Steps 1–4: presign → PUT bytes → register with cdnUrl → generate-captions.
 * Per API contract, presign must return `cdnUrl` (public URL after upload); Step 3 always uses that URL.
 * On step 4 failure, runs a second full upload (fresh presign + PUT) once.
 */
export async function runHumorFlavorPipelineFromImageFile(
  input: HumorFlavorPipelineFromFileInput,
): Promise<HumorFlavorPipelineResult> {
  const mock = process.env.ALMOSTCRACKD_MOCK === "true";
  if (mock) {
    return runHumorFlavorPipeline({
      accessToken: input.accessToken,
      imageUrl: "https://mock.invalid/uploaded-image",
      humorFlavorId: input.humorFlavorId,
      stepOrders: input.stepOrders,
      skipUrlAssert: true,
    });
  }

  if (!input.accessToken) {
    throw new Error(
      "No Supabase access token — sign in again or set ALMOSTCRACKD_MOCK=true for local stubs.",
    );
  }

  let lastErr: unknown = null;
  const fullPasses = Math.min(
    2,
    Math.max(1, Number(process.env.ALMOSTCRACKD_FULL_UPLOAD_PASSES ?? 1)),
  );

  for (let pass = 1; pass <= fullPasses; pass++) {
    if (pass > 1) {
      await sleep(2500);
    }
    try {
      return await presignPutThenPipeline(input);
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      const step4 = /Step 4|generate-captions/i.test(msg);
      if (step4 && pass < fullPasses) {
        continue;
      }
      throw e;
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export function parseCaptionsFromText(text: string): string[] {
  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/^\s*[-*•\d.)]+\s*/, "").trim())
    .filter(Boolean);
  if (lines.length > 1) return lines.slice(0, 10);
  return [text.trim()].filter(Boolean);
}
