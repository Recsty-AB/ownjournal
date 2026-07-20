import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, Edit } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { getActiveTagToken } from "@/utils/inlineTags";
import { getTextareaCaretRect } from "@/utils/textareaCaret";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Existing tags offered as inline `#tag` autocomplete. Omit to disable. */
  availableTags?: string[];
}

interface TagSuggestState {
  /** Index of the `#` character of the token being typed. */
  start: number;
  query: string;
  top: number;
  left: number;
}

const MAX_SUGGESTIONS = 8;
const DROPDOWN_WIDTH = 176; // w-44

export const MarkdownEditor = ({ value, onChange, placeholder, availableTags }: MarkdownEditorProps) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [suggest, setSuggest] = useState<TagSuggestState | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const inlineTagsEnabled = availableTags !== undefined;

  const suggestions = suggest
    ? (availableTags ?? [])
        .filter((tag) => tag.toLowerCase().includes(suggest.query.toLowerCase()))
        .sort((a, b) => {
          const q = suggest.query.toLowerCase();
          const aStarts = a.toLowerCase().startsWith(q) ? 0 : 1;
          const bStarts = b.toLowerCase().startsWith(q) ? 0 : 1;
          return aStarts - bStarts || a.localeCompare(b);
        })
        .slice(0, MAX_SUGGESTIONS)
    : [];

  const updateSuggestions = (textarea: HTMLTextAreaElement) => {
    if (!inlineTagsEnabled) return;
    const caret = textarea.selectionStart;
    const token =
      textarea.selectionStart === textarea.selectionEnd
        ? getActiveTagToken(textarea.value, caret)
        : null;
    if (!token) {
      setSuggest(null);
      return;
    }
    const rect = getTextareaCaretRect(textarea, token.start);
    const maxLeft = Math.max(0, textarea.clientWidth - DROPDOWN_WIDTH);
    setSuggest((prev) => {
      if (!prev || prev.start !== token.start) setSelectedIndex(0);
      return {
        start: token.start,
        query: token.query,
        top: rect.top + rect.height,
        left: Math.min(rect.left, maxLeft),
      };
    });
  };

  const acceptSuggestion = (tag: string) => {
    const textarea = textareaRef.current;
    if (!textarea || !suggest) return;
    const caret = textarea.selectionStart;
    const newValue = `${value.slice(0, suggest.start + 1)}${tag} ${value.slice(caret)}`;
    onChange(newValue);
    setSuggest(null);
    const newCaret = suggest.start + 1 + tag.length + 1;
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(newCaret, newCaret);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!suggest || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      acceptSuggestion(suggestions[selectedIndex] ?? suggestions[0]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setSuggest(null);
    }
  };

  return (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "edit" | "preview")} className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="edit" className="flex items-center gap-2">
          <Edit className="w-4 h-4" />
          {t('editor.edit')}
        </TabsTrigger>
        <TabsTrigger value="preview" className="flex items-center gap-2">
          <Eye className="w-4 h-4" />
          {t('editor.preview')}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="edit" className="mt-2">
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              updateSuggestions(e.currentTarget);
            }}
            onSelect={(e) => updateSuggestions(e.currentTarget)}
            onKeyDown={handleKeyDown}
            onBlur={() => setTimeout(() => setSuggest(null), 150)}
            placeholder={placeholder || t('editor.placeholder')}
            className="min-h-[300px] font-mono text-sm"
          />

          {/* Inline #tag autocomplete dropdown, anchored at the caret */}
          {suggest && suggestions.length > 0 && (
            <div
              className="absolute z-50 w-44 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto"
              style={{ top: suggest.top, left: suggest.left }}
            >
              {suggestions.map((tag, index) => (
                <button
                  key={tag}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => acceptSuggestion(tag)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                    index === selectedIndex
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          {t('editor.markdownSupport')}
          {inlineTagsEnabled && <> · {t('editor.inlineTagHint')}</>}
        </div>
      </TabsContent>

      <TabsContent value="preview" className="mt-2">
        <div className="min-h-[300px] p-4 border rounded-lg bg-background prose prose-sm max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
            {value || t('editor.noContentPreview')}
          </ReactMarkdown>
        </div>
      </TabsContent>
    </Tabs>
  );
};
