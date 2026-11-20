import { en } from './locales/en';

export type Language = 'vi' | 'en';

export const LANGUAGE_STORAGE_KEY = 'imap-language';

function compilePatterns(dictionary: Record<string, string>) {
  return (
    Object.entries(dictionary)
      .flatMap(([source, translated]) => {
        const names: string[] = [];
        const expression = source
          .split(/(\{[^{}]+\})/g)
          .map((part) => {
            const placeholder = /^\{([^{}]+)\}$/.exec(part);
            if (placeholder) {
              names.push(placeholder[1]!);
              return '(.+?)';
            }
            return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          })
          .join('');
        return names.length
          ? [
              {
                pattern: new RegExp(`^${expression}$`),
                translated,
                names,
                specificity: source.replace(/\{[^{}]+\}/g, '').length,
              },
            ]
          : [];
      })
      // Mẫu có nhiều chữ cố định chạy trước để mẫu rộng không bắt nhầm câu cụ thể.
      .sort((a, b) => b.specificity - a.specificity || a.names.length - b.names.length)
  );
}

export function readLanguage(storage?: Pick<Storage, 'getItem'>): Language {
  try {
    const value = (storage ?? (typeof window === 'undefined' ? undefined : window.localStorage))?.getItem(
      LANGUAGE_STORAGE_KEY,
    );
    return value === 'en' ? 'en' : 'vi';
  } catch {
    return 'vi';
  }
}

type Values = Record<string, string | number>;

/**
 * Dịch câu tiếng Việt sang ngôn ngữ đích theo từ điển. Câu có `{tên}` là mẫu: câu đã điền giá trị vẫn được
 * nhận ra và dịch, giá trị được giữ nguyên. Mẫu được biên dịch một lần khi tạo đối tượng.
 */
export class Translator {
  private readonly patterns: ReturnType<typeof compilePatterns>;

  constructor(private readonly dictionary: Record<string, string>) {
    this.patterns = compilePatterns(dictionary);
  }

  translate(language: Language, message: string, values?: Values): string {
    let result = language === 'en' ? (this.dictionary[message] ?? message) : message;
    let interpolatedValues = values;
    if (language === 'en' && result === message) {
      for (const { pattern, translated, names } of this.patterns) {
        const match = pattern.exec(message);
        if (!match) continue;
        result = translated;
        interpolatedValues = {
          ...Object.fromEntries(names.map((name, index) => [name, match[index + 1]!])),
          ...values,
        };
        break;
      }
    }
    if (interpolatedValues) {
      for (const [key, value] of Object.entries(interpolatedValues)) {
        result = result.replaceAll(`{${key}}`, String(value));
      }
    }
    return result;
  }
}

const translator = new Translator(en);

/** Dịch bằng từ điển mặc định của ứng dụng. */
export function translate(language: Language, message: string, values?: Values): string {
  return translator.translate(language, message, values);
}
