import type { AutomationItem } from '../types/automation';
import type { ModuleId, ProductId, StageName } from '../types/domain';
import { PRODUCT_LABEL } from '../types/domain';
import { fiscalYears, todayISO } from './date';
import { resolveTokens } from './tokens';

/**
 * Anthropic Messages API 스트리밍 클라이언트 (설계서 5.1)
 *
 * [보안] API Key 는 인자로만 전달받아 헤더에 실어 보낸다.
 *        값을 로그·에러 메시지·상태에 남기지 않는다.
 * [제약] 외부 CDN·SDK 번들 없이 fetch 로 직접 호출한다.
 *        브라우저에서 직접 호출하므로 anthropic-dangerous-direct-browser-access 헤더가 필요하다.
 */

const API_URL = 'https://api.anthropic.com/v1/messages';

/**
 * 사용 모델.
 * 설계서 5.1 원안은 claude-sonnet-4-6 이었으나 현행 최신 모델로 교체했다.
 * streamMessage({ model }) 로 호출 단위 재정의도 가능하다.
 */
export const MODEL = 'claude-opus-5';
const MAX_TOKENS = 1000;

export interface StreamOptions {
  apiKey: string;
  system?: string;
  userMessage: string;
  maxTokens?: number;
  model?: string;
  onDelta: (text: string) => void;
  onDone: (full: string) => void;
  onError: (err: Error) => void;
  signal?: AbortSignal;
}

/** SSE 이벤트 최소 형태 */
interface SseEvent {
  type?: string;
  delta?: { type?: string; text?: string };
  error?: { type?: string; message?: string };
}

/** 응답 본문에서 사용자에게 보여줄 오류 메시지 추출 (키 노출 방지) */
async function readErrorMessage(res: Response): Promise<string> {
  try {
    const text = await res.text();
    const json = JSON.parse(text) as { error?: { message?: string } };
    return json.error?.message ?? text.slice(0, 200);
  } catch {
    return `HTTP ${res.status}`;
  }
}

export async function streamMessage(opts: StreamOptions): Promise<void> {
  let full = '';

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': opts.apiKey,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: opts.model ?? MODEL,
        max_tokens: opts.maxTokens ?? MAX_TOKENS,
        stream: true,
        ...(opts.system ? { system: opts.system } : {}),
        messages: [{ role: 'user', content: opts.userMessage }],
      }),
      signal: opts.signal,
    });

    if (!res.ok || !res.body) {
      throw new Error(`API 오류 ${res.status}: ${await readErrorMessage(res)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      // 마지막 조각은 불완전할 수 있으므로 다음 청크와 합친다
      buffer = lines.pop() ?? '';

      for (const rawLine of lines) {
        const line = rawLine.replace(/\r$/, '');
        if (!line.startsWith('data:')) continue;

        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;

        let evt: SseEvent;
        try {
          evt = JSON.parse(payload) as SseEvent;
        } catch {
          continue; // 불완전 JSON 무시
        }

        if (evt.type === 'error') {
          throw new Error(`API 스트림 오류: ${evt.error?.message ?? '알 수 없는 오류'}`);
        }

        if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
          const text = evt.delta.text ?? '';
          if (text) {
            full += text;
            opts.onDelta(text);
          }
        }
      }
    }

    opts.onDone(full);
  } catch (err) {
    // 사용자가 중단한 경우는 오류로 취급하지 않는다
    if (err instanceof Error && err.name === 'AbortError') {
      opts.onDone(full);
      return;
    }
    opts.onError(err instanceof Error ? err : new Error(String(err)));
  }
}

/** 자동화 항목 실행 프롬프트 (설계서 5.2) */
export function buildItemPrompt(
  item: AutomationItem,
  product: ProductId,
  moduleId: ModuleId,
  moduleName: string,
  stage: StageName,
  base: Date = new Date()
): string {
  const { cy, py, ppy } = fiscalYears(base);
  const productName = PRODUCT_LABEL[product];
  const today = todayISO(base);

  return [
    `당신은 더존비즈온 ${productName} ERP 구축 전문 컨설턴트입니다.`,
    `현재: ${moduleId} ${moduleName} 모듈 "${stage}" 단계 (기준일: ${today})`,
    `작업: ${resolveTokens(item.task)}`,
    `도구: ${resolveTokens(item.tool)}`,
    '',
    '위 항목을 실무에서 즉시 활용 가능하도록 한국어로 생성해 주세요.',
    `K-IFRS 18 · ${cy}년 세법 · 3개년 비교(${ppy}/${py}/${cy}) · 수정분개 관련 항목은`,
    '구체적 수치와 체크리스트를 포함하세요.',
  ].join('\n');
}

/** 법령 AI 조회 시스템 프롬프트 */
export const LAW_QUERY_SYSTEM = (base: Date = new Date()): string =>
  `당신은 K-IFRS·한국 세법·더존비즈온 ERP(Amaranth10, OmniEsol) 전문가입니다. ` +
  `기준일: ${todayISO(base)}. 실무적이고 구체적인 답변을 한국어로 제공하세요.`;
